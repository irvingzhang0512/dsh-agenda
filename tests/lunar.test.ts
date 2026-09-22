/**
 * 农历转换测试：锚点日（春节/闰月/节日/跨年）+ 公农历往返抽样。
 * 锚点数据来自万年历常识与日历.js 参考实现。
 */
import { describe, expect, it } from 'vitest'
import {
  chineseDay, chineseMonth, isLunarNewYearEve, leapMonthOf, lunarCellText,
  lunarFestivalOf, lunarNewYearDay, lunarToSolar, solarToLunar,
} from '../src/core/lunar.ts'

describe('农历春节锚点（正月初一）', () => {
  it('2000-02-05 为庚辰年正月初一', () => {
    const lunar = solarToLunar('2000-02-05')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2000)
    expect(lunar!.lunarMonth).toBe(1)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunar!.isLeap).toBe(false)
    expect(lunarNewYearDay(2000)).toBe('2000-02-05')
  })

  it('2024-02-10 为甲辰年正月初一', () => {
    const lunar = solarToLunar('2024-02-10')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2024)
    expect(lunar!.lunarMonth).toBe(1)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunarNewYearDay(2024)).toBe('2024-02-10')
  })

  it('2025-01-29 为乙巳年正月初一', () => {
    const lunar = solarToLunar('2025-01-29')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2025)
    expect(lunar!.lunarMonth).toBe(1)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunarNewYearDay(2025)).toBe('2025-01-29')
  })

  it('2026-02-17 为丙午年正月初一', () => {
    const lunar = solarToLunar('2026-02-17')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2026)
    expect(lunar!.lunarMonth).toBe(1)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunarNewYearDay(2026)).toBe('2026-02-17')
  })
})

describe('闰月锚点', () => {
  it('2020 年闰四月初一 = 2020-05-23', () => {
    expect(leapMonthOf(2020)).toBe(4)
    const lunar = solarToLunar('2020-05-23')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2020)
    expect(lunar!.lunarMonth).toBe(4)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunar!.isLeap).toBe(true)
  })

  it('2023 年闰二月初一 = 2023-03-22', () => {
    expect(leapMonthOf(2023)).toBe(2)
    const lunar = solarToLunar('2023-03-22')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2023)
    expect(lunar!.lunarMonth).toBe(2)
    expect(lunar!.lunarDay).toBe(1)
    expect(lunar!.isLeap).toBe(true)
  })

  it('2025 年有闰六月', () => {
    expect(leapMonthOf(2025)).toBe(6)
  })
})

describe('节日与特殊日', () => {
  it('2026-09-25 为八月十五中秋节', () => {
    const lunar = solarToLunar('2026-09-25')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarMonth).toBe(8)
    expect(lunar!.lunarDay).toBe(15)
    expect(lunarFestivalOf(lunar!)).toBe('中秋节')
  })

  it('1949-10-01 为八月初十', () => {
    const lunar = solarToLunar('1949-10-01')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(1949)
    expect(lunar!.lunarMonth).toBe(8)
    expect(lunar!.lunarDay).toBe(10)
    expect(chineseDay(10)).toBe('初十')
  })

  it('2025-01-28 为除夕', () => {
    expect(isLunarNewYearEve('2025-01-28')).toBe(true)
    const lunar = solarToLunar('2025-01-28')
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarMonth).toBe(12)
    expect(lunar!.lunarDay).toBe(29)
  })
})

describe('展示文本', () => {
  it('初一显示月名，其他显示日名', () => {
    const first = solarToLunar('2026-02-17')
    expect(first).not.toBeNull()
    expect(lunarCellText(first!)).toBe('正月')
    const fifteen = solarToLunar('2026-09-25')
    expect(fifteen).not.toBeNull()
    expect(lunarCellText(fifteen!)).toBe('十五')
  })

  it('闰月前缀', () => {
    expect(chineseMonth(4, true)).toBe('闰四月')
    expect(chineseDay(1)).toBe('初一')
    expect(chineseDay(23)).toBe('廿三')
    expect(chineseDay(30)).toBe('三十')
  })
})

describe('公农历往返（确定性抽样）', () => {
  it('1949-10-01 至 2099-12-31 每 37 天往返一致', () => {
    const start = Date.UTC(1949, 9, 1)
    const end = Date.UTC(2099, 11, 31)
    let cursor = start
    let count = 0
    while (cursor <= end) {
      const date = new Date(cursor).toISOString().slice(0, 10)
      const lunar = solarToLunar(date)
      expect(lunar, date).not.toBeNull()
      const back = lunarToSolar(lunar!)
      expect(back, `${date} → 农历往返`).toBe(date)
      cursor += 37 * 86400000
      count += 1
    }
    expect(count).toBeGreaterThan(1400)
  })

  it('农历闰月日期也能正确往返', () => {
    // 2020 闰四月初十
    const solar = lunarToSolar({ lunarYear: 2020, lunarMonth: 4, lunarDay: 10, isLeap: true })
    expect(solar).toBe('2020-06-01')
    const back = solarToLunar('2020-06-01')
    expect(back).not.toBeNull()
    expect(back!.isLeap).toBe(true)
    expect(back!.lunarMonth).toBe(4)
    expect(back!.lunarDay).toBe(10)
  })
})

describe('边界', () => {
  it('非法农历组合返回 null', () => {
    expect(lunarToSolar({ lunarYear: 2025, lunarMonth: 6, lunarDay: 1, isLeap: true })).toBe('2025-07-25')
    // 非闰年的闰月请求
    expect(lunarToSolar({ lunarYear: 2024, lunarMonth: 4, lunarDay: 1, isLeap: true })).toBeNull()
    // 超出月份天数
    expect(lunarToSolar({ lunarYear: 2025, lunarMonth: 2, lunarDay: 30, isLeap: false })).toBeNull()
  })

  it('范围外日期返回 null', () => {
    expect(solarToLunar('1899-12-31')).toBeNull()
    const day = lunarNewYearDay(2099)
    expect(day).not.toBeNull()
    const lunar = solarToLunar(day!)
    expect(lunar).not.toBeNull()
    expect(lunar!.lunarYear).toBe(2099)
    expect(lunar!.lunarMonth).toBe(1)
    expect(lunar!.lunarDay).toBe(1)
  })
})
