/**
 * 节假日判定测试：2025 / 2026 官方数据（国务院办公厅公告）+ 优先级规则。
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'
import { HolidayService } from '../src/core/holidays.ts'

const HOLIDAY_2025: import('../src/storage/storage.ts').HolidayYear = {
  year: 2025,
  holidays: [
    { name: '元旦', dates: ['2025-01-01'] },
    { name: '春节', dates: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04'] },
    { name: '清明节', dates: ['2025-04-04', '2025-04-05', '2025-04-06'] },
    { name: '劳动节', dates: ['2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05'] },
    { name: '端午节', dates: ['2025-05-31', '2025-06-01', '2025-06-02'] },
    { name: '国庆节中秋节', dates: ['2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08'] },
  ],
  workdays: ['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11'],
}

const HOLIDAY_2026: import('../src/storage/storage.ts').HolidayYear = {
  year: 2026,
  holidays: [
    { name: '元旦', dates: ['2026-01-01', '2026-01-02', '2026-01-03'] },
    { name: '春节', dates: ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23'] },
    { name: '清明节', dates: ['2026-04-04', '2026-04-05', '2026-04-06'] },
    { name: '劳动节', dates: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'] },
    { name: '端午节', dates: ['2026-06-19', '2026-06-20', '2026-06-21'] },
    { name: '中秋节', dates: ['2026-09-25', '2026-09-26', '2026-09-27'] },
    { name: '国庆节', dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'] },
  ],
  workdays: ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'],
}

/** 周几助手：1=周一 … 7=周日。 */
function weekdayOf(date: string): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
}

async function makeService(): Promise<{ storage: CsvAgendaStorage, service: HolidayService, dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agenda-holiday-'))
  const storage = new CsvAgendaStorage(dir)
  await storage.ensureLayout()
  const service = new HolidayService(storage)
  await service.writeYear(HOLIDAY_2025)
  await service.writeYear(HOLIDAY_2026)
  return { storage, service, dir }
}

describe('2025 官方节假日（国办发明电〔2024〕12号）', () => {
  it('元旦 / 春节 / 调休', async () => {
    const { service, dir } = await makeService()
    try {
      expect(await service.dayKind('2025-01-01', weekdayOf('2025-01-01'))).toEqual({ type: 'holiday', holidayName: '元旦' })
      expect(await service.dayKind('2025-01-29', weekdayOf('2025-01-29'))).toEqual({ type: 'holiday', holidayName: '春节' })
      expect(await service.dayKind('2025-02-04', weekdayOf('2025-02-04'))).toEqual({ type: 'holiday', holidayName: '春节' })
      // 调休上班：周日（1-26）/ 周六（2-8）
      expect(await service.dayKind('2025-01-26', weekdayOf('2025-01-26'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2025-02-08', weekdayOf('2025-02-08'))).toEqual({ type: 'adjusted-workday' })
      // 春节前后普通周末
      expect(await service.dayKind('2025-02-09', weekdayOf('2025-02-09'))).toEqual({ type: 'weekend' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('清明 / 劳动节 / 端午 / 国庆中秋', async () => {
    const { service, dir } = await makeService()
    try {
      expect(await service.dayKind('2025-04-04', weekdayOf('2025-04-04'))).toEqual({ type: 'holiday', holidayName: '清明节' })
      expect(await service.dayKind('2025-05-01', weekdayOf('2025-05-01'))).toEqual({ type: 'holiday', holidayName: '劳动节' })
      expect(await service.dayKind('2025-05-31', weekdayOf('2025-05-31'))).toEqual({ type: 'holiday', holidayName: '端午节' })
      expect(await service.dayKind('2025-10-01', weekdayOf('2025-10-01'))).toEqual({ type: 'holiday', holidayName: '国庆节中秋节' })
      expect(await service.dayKind('2025-10-08', weekdayOf('2025-10-08'))).toEqual({ type: 'holiday', holidayName: '国庆节中秋节' })
      expect(await service.dayKind('2025-09-28', weekdayOf('2025-09-28'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2025-10-11', weekdayOf('2025-10-11'))).toEqual({ type: 'adjusted-workday' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('2026 官方节假日（国办发明电〔2025〕7号）', () => {
  it('元旦 / 春节 / 清明 / 劳动节', async () => {
    const { service, dir } = await makeService()
    try {
      expect(await service.dayKind('2026-01-01', weekdayOf('2026-01-01'))).toEqual({ type: 'holiday', holidayName: '元旦' })
      expect(await service.dayKind('2026-01-04', weekdayOf('2026-01-04'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2026-02-17', weekdayOf('2026-02-17'))).toEqual({ type: 'holiday', holidayName: '春节' })
      expect(await service.dayKind('2026-02-14', weekdayOf('2026-02-14'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2026-02-28', weekdayOf('2026-02-28'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2026-04-04', weekdayOf('2026-04-04'))).toEqual({ type: 'holiday', holidayName: '清明节' })
      expect(await service.dayKind('2026-05-05', weekdayOf('2026-05-05'))).toEqual({ type: 'holiday', holidayName: '劳动节' })
      expect(await service.dayKind('2026-05-09', weekdayOf('2026-05-09'))).toEqual({ type: 'adjusted-workday' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('端午 / 中秋 / 国庆 / 调休', async () => {
    const { service, dir } = await makeService()
    try {
      expect(await service.dayKind('2026-06-19', weekdayOf('2026-06-19'))).toEqual({ type: 'holiday', holidayName: '端午节' })
      expect(await service.dayKind('2026-09-25', weekdayOf('2026-09-25'))).toEqual({ type: 'holiday', holidayName: '中秋节' })
      expect(await service.dayKind('2026-10-01', weekdayOf('2026-10-01'))).toEqual({ type: 'holiday', holidayName: '国庆节' })
      expect(await service.dayKind('2026-09-20', weekdayOf('2026-09-20'))).toEqual({ type: 'adjusted-workday' })
      expect(await service.dayKind('2026-10-10', weekdayOf('2026-10-10'))).toEqual({ type: 'adjusted-workday' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('优先级与无数据年份', () => {
  it('调休上班 > 法定假日 > 周末 > 工作日', async () => {
    const { service, dir } = await makeService()
    try {
      // 普通周六 / 周日
      expect(await service.dayKind('2026-03-07', weekdayOf('2026-03-07'))).toEqual({ type: 'weekend' })
      expect(await service.dayKind('2026-03-02', weekdayOf('2026-03-02'))).toEqual({ type: 'workday' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('无数据年份回退为周末/工作日', async () => {
    const { service, dir } = await makeService()
    try {
      // 2027 官方未发布
      expect(await service.dayKind('2027-10-01', weekdayOf('2027-10-01'))).toEqual({ type: 'workday' })
      expect(await service.dayKind('2027-10-02', weekdayOf('2027-10-02'))).toEqual({ type: 'weekend' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
