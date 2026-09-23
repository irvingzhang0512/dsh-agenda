/**
 * 待办重复推演测试：天/周/月/年 + 农历每年（含月末、闰年 2/29、闰月基准）。
 */
import { describe, expect, it } from 'vitest'
import { todoOccurrenceDates } from '../src/core/recurrence.ts'
import type { TodoBase } from '../src/core/recurrence.ts'

const base = (overrides: Partial<TodoBase> & { date: string }): TodoBase => overrides

describe('单次待办', () => {
  it('范围内返回 [date]，范围外返回空', () => {
    expect(todoOccurrenceDates(base({ date: '2026-09-15' }), '2026-09-01', '2026-09-30')).toEqual(['2026-09-15'])
    expect(todoOccurrenceDates(base({ date: '2026-09-15' }), '2026-10-01', '2026-10-31')).toEqual([])
  })
})

describe('daily / weekly', () => {
  it('每天：基准日起逐日', () => {
    const dates = todoOccurrenceDates(base({ date: '2026-09-01', recurrence: 'daily' }), '2026-09-01', '2026-09-05')
    expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
  })

  it('每周：每 7 天', () => {
    const dates = todoOccurrenceDates(base({ date: '2026-09-01', recurrence: 'weekly' }), '2026-09-01', '2026-09-30')
    expect(dates).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'])
  })

  it('范围起点截断：只返回范围内的实例', () => {
    const dates = todoOccurrenceDates(base({ date: '2026-09-01', recurrence: 'weekly' }), '2026-09-10', '2026-09-25')
    expect(dates).toEqual(['2026-09-15', '2026-09-22'])
  })
})

describe('monthly', () => {
  it('每月同日', () => {
    const dates = todoOccurrenceDates(base({ date: '2026-01-15', recurrence: 'monthly' }), '2026-02-01', '2026-05-31')
    expect(dates).toEqual(['2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15'])
  })

  it('基准为月末（31 号）时短月取当月最后一天', () => {
    const dates = todoOccurrenceDates(base({ date: '2026-01-31', recurrence: 'monthly' }), '2026-02-01', '2026-04-30')
    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })
})

describe('yearly（公历）', () => {
  it('每年同月同日', () => {
    const dates = todoOccurrenceDates(base({ date: '2025-03-20', recurrence: 'yearly' }), '2025-03-20', '2028-03-31')
    expect(dates).toEqual(['2025-03-20', '2026-03-20', '2027-03-20', '2028-03-20'])
  })

  it('2/29 在平年取 2/28，闰年回 2/29', () => {
    const dates = todoOccurrenceDates(base({ date: '2024-02-29', recurrence: 'yearly' }), '2024-02-29', '2028-03-01')
    expect(dates).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })
})

describe('yearly（农历基准）', () => {
  it('每年农历八月十五（2026→2027 换算正确）', () => {
    const dates = todoOccurrenceDates(base({
      date: '2026-09-25', recurrence: 'yearly', calendarType: 'lunar',
      lunarYear: 2026, lunarMonth: 8, lunarDay: 15, lunarLeap: false,
    }), '2026-01-01', '2027-12-31')
    expect(dates).toEqual(['2026-09-25', '2027-09-15'])
  })

  it('闰月基准在无闰年取同名非闰月', () => {
    // 2020 闰四月初一 = 2020-05-23；2021 无闰四月 → 非闰四月初一 = 2021-05-12
    const dates = todoOccurrenceDates(base({
      date: '2020-05-23', recurrence: 'yearly', calendarType: 'lunar',
      lunarYear: 2020, lunarMonth: 4, lunarDay: 1, lunarLeap: true,
    }), '2020-01-01', '2021-12-31')
    expect(dates).toEqual(['2020-05-23', '2021-05-12'])
  })
})
