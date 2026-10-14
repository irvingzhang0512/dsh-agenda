import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import yaml from 'js-yaml'
import { createHolidaySource } from '../src/host/holiday-source.ts'
import { mergeHolidayYear, normalizeHolidayYear } from '../src/core/holiday-data.ts'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'
import { AgendaService } from '../src/core/agenda.ts'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'agenda-040-data-'))
  const storage = new CsvAgendaStorage(dir); await storage.ensureLayout()
  const source = createHolidaySource()
  return { dir, storage, source, service: new AgendaService(storage, { holidaySource: source }) }
}

describe('离线库与旧年度资料', () => {
  it('读取真实固定 npm 全部年份，并识别放假／补班与未收录年份', async () => {
    const f = await fixture()
    try {
      expect(f.source.packageVersion).toBe('1.5.9')
      expect(await f.source.availableYears()).toEqual(Array.from({ length: 23 }, (_, i) => i + 2004))
      expect((await f.service.snapshot()).holidayData.warnings).toEqual([])
      expect(await f.service.holidays.dayKind('2026-01-01', 4)).toEqual({ type: 'holiday', holidayName: '元旦' })
      expect(await f.service.holidays.dayKind('2026-02-17', 2)).toEqual({ type: 'holiday', holidayName: '春节' })
      expect(await f.service.holidays.dayKind('2026-10-01', 4)).toEqual({ type: 'holiday', holidayName: '国庆节' })
      expect(await f.service.holidays.dayKind('2026-10-10', 6)).toEqual({ type: 'adjusted-workday' })
      expect(await f.service.holidays.dayKind('2026-01-04', 7)).toEqual({ type: 'adjusted-workday' })
      expect(await f.service.holidays.dayKind('2026-02-14', 6)).toEqual({ type: 'adjusted-workday' })
      expect(await f.service.holidays.dayKind('2026-04-04', 6)).toEqual({ type: 'holiday', holidayName: '清明节' })
      expect(await f.service.holidays.dayKind('2027-10-01', 5)).toEqual({ type: 'workday' })
      expect(await readdir(join(f.dir, 'holidays'))).toEqual([])
      const version = f.service.version
      await f.service.refreshHolidays()
      expect(f.service.version).toBe(version)
    } finally { await rm(f.dir, { recursive: true, force: true }) }
  })
  it('旧 seed 继承更新库，手改与删除标记保留，而不改原始字节', async () => {
    const f = await fixture()
    try {
      const legacy = (await f.source.legacyYear(2026))!
      const next = { ...legacy, workdays: [...legacy.workdays, '2026-03-07'] }
      expect(mergeHolidayYear(next, legacy, legacy).data?.workdays).toContain('2026-03-07')
      const local = structuredClone(legacy)
      local.holidays[0]!.dates = local.holidays[0]!.dates.filter(d => d !== '2026-01-02')
      local.holidays.push({ name: '自定义假期', dates: ['2026-03-02'] })
      const raw = '# 我的注释\n' + yaml.dump({ ...local, custom: '保持未知字段' })
      const path = join(f.dir, 'holidays/2026.yaml'); await writeFile(path, raw)
      expect(await f.service.holidays.dayKind('2026-01-02', 5)).toEqual({ type: 'workday' })
      expect(await f.service.holidays.dayKind('2026-03-02', 1)).toEqual({ type: 'holiday', holidayName: '自定义假期' })
      const summary = (await f.service.snapshot()).holidayData
      expect(summary.localOverrideYears).toContain(2026); expect(summary.legacyFullYears).not.toContain(2026)
      expect(await readFile(path, 'utf8')).toBe(raw)
    } finally { await rm(f.dir, { recursive: true, force: true }) }
  })
  it('没有比较基线时保持整年本地语义；无效修改保持上一次有效结果', async () => {
    const f = await fixture()
    try {
      await f.storage.writeHolidayYear({ year: 2024, holidays: [{ name: '自定义', dates: ['2024-03-01'] }], workdays: [] })
      expect(await f.service.holidays.dayKind('2024-01-01', 1)).toEqual({ type: 'workday' })
      expect((await f.service.snapshot()).holidayData.legacyFullYears).toContain(2024)
      await writeFile(join(f.dir, 'holidays/2024.yaml'), 'holidays: [broken')
      await f.service.refreshHolidays()
      expect(await f.service.holidays.dayKind('2024-03-01', 5)).toEqual({ type: 'holiday', holidayName: '自定义' })
      expect((await f.service.snapshot()).holidayData.warnings.join()).toContain('2024')
    } finally { await rm(f.dir, { recursive: true, force: true }) }
  })
  it('拒绝非法日期、年份与同日放假／补班冲突', () => {
    for (const data of [
      { year: 2026, holidays: [{ name: '错误', dates: ['2026-02-30'] }], workdays: [] },
      { year: 2025, holidays: [], workdays: [] },
      { year: 2026, holidays: [{ name: '休', dates: ['2026-01-01'] }], workdays: ['2026-01-01'] },
    ]) expect(() => normalizeHolidayYear(data, 2026)).toThrow()
  })
})

describe('业务设置的并发保护与通知', () => {
  it('同一修订仅一方保存成功，保留未知字段；非法值不写文件', async () => {
    const f = await fixture()
    try {
      const path = join(f.dir, 'settings.yaml')
      await writeFile(path, 'weekStart: monday\ncustom: keep\n')
      const snapshot = await f.service.snapshot()
      const results = await Promise.allSettled([
        f.service.updateSettings({ weekStart: 'sunday' }, snapshot.settingsRevision),
        f.service.updateSettings({ weekStart: 'monday' }, snapshot.settingsRevision),
      ])
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      expect(yaml.load(await readFile(path, 'utf8'))).toEqual({ weekStart: 'sunday', custom: 'keep' })
      const previous = await readFile(path, 'utf8')
      await expect(f.service.updateSettings({ weekStart: 'bad' as never }, (await f.service.snapshot()).settingsRevision)).rejects.toMatchObject({ code: 'INVALID_SETTINGS' })
      expect(await readFile(path, 'utf8')).toBe(previous)
    } finally { await rm(f.dir, { recursive: true, force: true }) }
  })
  it('格式错误保留原件；成功写入各通知一次，失败不通知', async () => {
    const f = await fixture()
    try {
      let changes = 0; const remove = f.service.subscribe(() => { changes++ })
      await f.service.createEvent({ title: '测试', start: '2026-10-01' })
      await f.service.createTodo({ title: '待办', date: '2026-10-01' })
      await expect(f.service.createEvent({ title: '', start: '2026-10-01' })).rejects.toThrow()
      expect(changes).toBe(2)
      const path = join(f.dir, 'settings.yaml'), raw = 'weekStart: [broken'
      await writeFile(path, raw)
      await expect(f.service.updateSettings({ weekStart: 'sunday' }, (await f.service.snapshot()).settingsRevision)).rejects.toMatchObject({ code: 'INVALID_SETTINGS' })
      expect(await readFile(path, 'utf8')).toBe(raw); expect(changes).toBe(2)
      remove()
    } finally { await rm(f.dir, { recursive: true, force: true }) }
  })
})
