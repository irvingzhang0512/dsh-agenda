/** 解析 agenda 数据目录。 */
export declare function resolveDataDir(env?: NodeJS.ProcessEnv, home?: string): string;
/** 串行化同一路径的异步临界区（进程内）。 */
export declare function withInProcessLock<T>(key: string, section: () => Promise<T>): Promise<T>;
export interface AtomicWriteOptions {
    /** 备份目录；提供时在替换前把旧文件复制为 `<dir>/<basename>.<ts>.bak`。 */
    backupDir?: string;
    /** 每个文件保留的备份数量上限。 */
    keepBackups?: number;
}
/**
 * 原子替换写：读取最新 →（调用方在锁内完成计算）→ 写 `.tmp` → 备份 → rename。
 * rename 在同一目录内进行，Windows 上等价 MoveFileEx(REPLACE_EXISTING)。
 */
export declare function atomicWriteFile(path: string, content: string, options?: AtomicWriteOptions): Promise<void>;
/**
 * 完整写路径（需求 §16）：读取最新文件 → 获取文件锁 → 变更 → 写 .tmp →
 * 原子替换 → 释放锁。mutate 在锁内执行，可返回任意结果（透传给调用方）；
 * mutate 抛错则不落盘。
 */
export declare function withLockedFile<T>(path: string, options: AtomicWriteOptions, mutate: (current: string | null) => Promise<{
    value: T;
    content: string;
}> | {
    value: T;
    content: string;
}): Promise<T>;
