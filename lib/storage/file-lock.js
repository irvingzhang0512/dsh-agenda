/**
 * dsh-agenda — 数据目录解析与文件锁。
 *
 * 数据目录（用户级全局数据，与 Workspace、插件安装目录分离）：
 *
 *   <DSH_DATA_DIR>/agenda/          （环境变量优先）
 *   <DSH_HOME>/data/agenda/         （默认 ~/.dsh/data/agenda/）
 *
 * 代码不写死任何用户路径，全部运行时解析。
 *
 * 文件锁两层：
 * 1. 进程内：同一路径的互斥队列（UI / Agent 工具并发共享同一宿主进程）；
 * 2. 跨进程：`.lock` 伴生文件（O_EXCL 创建），持有者写 pid+时间戳，
 *    过期（STALE_MS）后可接管，避免宿主崩溃后死锁。
 */
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
/** 跨进程锁过期接管阈值。 */
const STALE_MS = 10_000;
/** 获取锁的重试间隔与超时。 */
const RETRY_MS = 40;
const ACQUIRE_TIMEOUT_MS = 8_000;
/** 解析 agenda 数据目录。 */
export function resolveDataDir(env = process.env, home = homedir()) {
    if (typeof env.DSH_DATA_DIR === 'string' && env.DSH_DATA_DIR !== '') {
        return join(env.DSH_DATA_DIR, 'agenda');
    }
    const dshHome = typeof env.DSH_HOME === 'string' && env.DSH_HOME !== '' ? env.DSH_HOME : join(home, '.dsh');
    return join(dshHome, 'data', 'agenda');
}
// ─── 进程内互斥 ───────────────────────────────────────────────────────────
const queues = new Map();
/** 串行化同一路径的异步临界区（进程内）。 */
export function withInProcessLock(key, section) {
    const previous = queues.get(key) ?? Promise.resolve();
    const result = previous.then(section, section);
    const tail = result.then(() => undefined, () => undefined);
    queues.set(key, tail);
    void tail.finally(() => {
        if (queues.get(key) === tail)
            queues.delete(key);
    });
    return result;
}
async function acquireFileLock(path) {
    const lockPath = `${path}.lock`;
    const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
    // 先清理一次过期锁（存在且超龄）
    const takeoverStale = async () => {
        try {
            const info = await stat(lockPath);
            if (Date.now() - info.mtimeMs < STALE_MS)
                return false;
            await rm(lockPath, { force: true });
            return true;
        }
        catch {
            return true;
        }
    };
    for (;;) {
        try {
            const handle = await open(lockPath, 'wx');
            await handle.writeFile(`${process.pid} ${Date.now()}`, 'utf8');
            await handle.close();
            break;
        }
        catch (error) {
            const code = error.code;
            if (code !== 'EEXIST')
                throw error;
            if (Date.now() > deadline) {
                if (await takeoverStale())
                    continue; // 最后一次机会：过期强制接管
                throw new Error(`获取文件锁超时: ${path}`);
            }
            await takeoverStale();
            await new Promise(resolve => setTimeout(resolve, RETRY_MS));
        }
    }
    // 锁文件存在期间持续续期，防止长写被误判过期
    const heartbeat = setInterval(() => {
        void writeFile(lockPath, `${process.pid} ${Date.now()}`, 'utf8').catch(() => undefined);
    }, Math.floor(STALE_MS / 3));
    return {
        release: async () => {
            clearInterval(heartbeat);
            await rm(lockPath, { force: true }).catch(() => undefined);
        },
    };
}
/**
 * 原子替换写：读取最新 →（调用方在锁内完成计算）→ 写 `.tmp` → 备份 → rename。
 * rename 在同一目录内进行，Windows 上等价 MoveFileEx(REPLACE_EXISTING)。
 */
export async function atomicWriteFile(path, content, options = {}) {
    await mkdir(dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp`;
    await writeFile(tmpPath, content, { flag: 'w' });
    try {
        if (options.backupDir !== undefined && existsSync(path)) {
            const previous = await readFile(path, 'utf8').catch(() => null);
            if (previous !== null) {
                await mkdir(options.backupDir, { recursive: true });
                const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
                await writeFile(join(options.backupDir, `${basenameOf(path)}.${stamp}.bak`), previous, { flag: 'w' });
                await pruneBackups(options.backupDir, basenameOf(path), options.keepBackups ?? 10);
            }
        }
        await rename(tmpPath, path);
    }
    finally {
        await rm(tmpPath, { force: true }).catch(() => undefined);
    }
}
function basenameOf(path) {
    const parts = path.replaceAll('\\', '/').split('/');
    return parts[parts.length - 1] ?? path;
}
/** 只保留最近 keep 个 `name.*.bak`。 */
async function pruneBackups(backupDir, name, keep) {
    const prefix = `${name}.`;
    const entries = (await readdir(backupDir).catch(() => []))
        .filter(entry => entry.startsWith(prefix) && entry.endsWith('.bak'))
        .sort();
    const excess = entries.slice(0, Math.max(0, entries.length - keep));
    for (const entry of excess)
        await rm(join(backupDir, entry), { force: true }).catch(() => undefined);
}
// ─── 组合：带锁的读-改-写 ────────────────────────────────────────────────
/**
 * 完整写路径（需求 §16）：读取最新文件 → 获取文件锁 → 变更 → 写 .tmp →
 * 原子替换 → 释放锁。mutate 在锁内执行，可返回任意结果（透传给调用方）；
 * mutate 抛错则不落盘。
 */
export async function withLockedFile(path, options, mutate) {
    return withInProcessLock(path, async () => {
        await mkdir(dirname(path), { recursive: true });
        const lock = await acquireFileLock(path);
        try {
            const current = await readFile(path, 'utf8').catch((error) => { if (error.code === 'ENOENT')
                return null; throw error; });
            const outcome = await mutate(current);
            if (outcome.content !== current)
                await atomicWriteFile(path, outcome.content, options);
            return outcome.value;
        }
        finally {
            await lock.release();
        }
    });
}
