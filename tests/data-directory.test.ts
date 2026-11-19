import { describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveDataDir } from '../src/storage/file-lock.ts'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'

describe('日程实例选择存储目录', () => {
  it('显式绝对目录优先，空值沿用既有解析顺序', () => {
    const base = tmpdir()
    const env = { DSH_DATA_DIR: join(base, 'shared'), DSH_HOME: join(base, 'home') }
    expect(resolveDataDir(env, base, join(base, 'chosen'))).toBe(join(base, 'chosen'))
    expect(resolveDataDir(env, base, '')).toBe(join(env.DSH_DATA_DIR, 'agenda'))
    expect(resolveDataDir({ DSH_HOME: env.DSH_HOME }, base)).toBe(join(env.DSH_HOME, 'data', 'agenda'))
    expect(resolveDataDir({}, base)).toBe(join(base, '.dsh', 'data', 'agenda'))
    expect(() => resolveDataDir(env, base, '../relative')).toThrow(/绝对路径/)
  })
  it('重开继续使用显式目录，文件目标会失败', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agenda-directory-'))
    try {
      const target = join(root, 'chosen')
      const open = () => new CsvAgendaStorage(resolveDataDir({ DSH_HOME: join(root, 'unused') }, root, target))
      await open().ensureLayout()
      await writeFile(join(target, 'settings.yaml'), 'weekStart: 1\n')
      await open().ensureLayout()
      expect(await readdir(root)).toEqual(['chosen'])
      expect(await readdir(target)).toEqual(expect.arrayContaining(['settings.yaml', 'holidays', 'backup']))
      await expect(new CsvAgendaStorage(join(target, 'settings.yaml')).ensureLayout()).rejects.toThrow()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
