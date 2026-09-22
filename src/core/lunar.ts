/**
 * dsh-agenda — 农历转换（LunarService 的纯函数核心）。
 *
 * 数据表与边界行为源自社区广泛验证的 calendar.js 数据（1900–2100，
 * 每年一个 bit 位压缩值），算法在本仓库内以 TypeScript 重新实现：
 *
 * - bit 0–3  ：闰月月份（0 = 当年无闰月）
 * - bit 4–15 ：十二月的大小月标志（bit4=腊月 … bit15=正月；置位为 30 天）
 * - bit 16   ：闰月为大月（30 天）
 *
 * 纪元锚点：1900-01-31（UTC）= 农历 1900 年正月初一。所有日期运算
 * 使用 UTC 日历日，避免宿主时区/夏令时干扰。支持范围 1900-01-31 至
 * 2099-12-31（2100 年仅支持到其农历腊月内的一部分，与参考实现一致，
 * 本模块显式限制在 2099 冬季之前，超出即返回 null）。
 */

/** 1900–2100 年农历年压缩信息表（每年一项，索引 = 年份 - 1900）。 */
const LUNAR_INFO: readonly number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
]

/** 纪元：农历 1900 年正月初一的公历日（UTC）。 */
const LUNAR_EPOCH_UTC = Date.UTC(1900, 0, 31)
/** 农历表的最早/最晚年。 */
export const LUNAR_MIN_YEAR = 1900
export const LUNAR_MAX_YEAR = 2099

/** 农历日期（lunar year 与 isLeap 是一等公民，跨年无损）。 */
export interface LunarDate {
  lunarYear: number
  /** 1–12。 */
  lunarMonth: number
  /** 1–30。 */
  lunarDay: number
  /** 该月是否闰月。 */
  isLeap: boolean
}

/** 一年中一个农历月的描述（按真实顺序排列）。 */
interface LunarMonthDesc {
  month: number
  isLeap: boolean
  days: number
}

/** 年份越界返回 null。 */
function infoOf(lunarYear: number): number | null {
  if (lunarYear < LUNAR_MIN_YEAR || lunarYear > 2100) return null
  return LUNAR_INFO[lunarYear - 1900] ?? null
}

/** 农历年闰月月份；0 = 无闰月。 */
export function leapMonthOf(lunarYear: number): number {
  return (infoOf(lunarYear) ?? 0) & 0xf
}

/** 农历年闰月天数；无闰月为 0。 */
export function leapDaysOf(lunarYear: number): number {
  const info = infoOf(lunarYear)
  if (info === null || (info & 0xf) === 0) return 0
  return (info & 0x10000) !== 0 ? 30 : 29
}

/** 农历普通月（非闰月）天数；月份非法返回 null。 */
export function monthDaysOf(lunarYear: number, lunarMonth: number): number | null {
  const info = infoOf(lunarYear)
  if (info === null || lunarMonth < 1 || lunarMonth > 12) return null
  return (info & (0x10000 >> lunarMonth)) !== 0 ? 30 : 29
}

/** 农历年总天数（含闰月）。 */
export function lunarYearDays(lunarYear: number): number {
  const info = infoOf(lunarYear)
  if (info === null) return 0
  let sum = 348
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if ((info & bit) !== 0) sum += 1
  }
  return sum + leapDaysOf(lunarYear)
}

/** 农历年正月初一的公历 `YYYY-MM-DD`；越界返回 null。 */
export function lunarNewYearDay(lunarYear: number): string | null {
  if (lunarYear < LUNAR_MIN_YEAR || lunarYear > LUNAR_MAX_YEAR) return null
  let days = 0
  for (let year = LUNAR_MIN_YEAR; year < lunarYear; year += 1) days += lunarYearDays(year)
  return new Date(LUNAR_EPOCH_UTC + days * 86400000).toISOString().slice(0, 10)
}

/** 某农历年的全部月份，按时间顺序（含闰月插入）。 */
function monthsInYear(lunarYear: number): LunarMonthDesc[] | null {
  const info = infoOf(lunarYear)
  if (info === null) return null
  const leap = info & 0xf
  const months: LunarMonthDesc[] = []
  for (let m = 1; m <= 12; m += 1) {
    months.push({ month: m, isLeap: false, days: (info & (0x10000 >> m)) !== 0 ? 30 : 29 })
    if (leap === m) {
      months.push({ month: m, isLeap: true, days: leapDaysOf(lunarYear) })
    }
  }
  return months
}

// ─── 展示文本 ─────────────────────────────────────────────────────────────

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'] as const
const DAY_CN = ['日', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const

/** 农历日数字 → 汉字（初一、初十、十五、二十、廿三、三十…）。 */
export function chineseDay(lunarDay: number): string {
  if (lunarDay === 10) return '初十'
  if (lunarDay === 20) return '二十'
  if (lunarDay === 30) return '三十'
  if (lunarDay < 10) return '初' + DAY_CN[lunarDay]
  if (lunarDay < 20) return '十' + DAY_CN[lunarDay % 10]
  return '廿' + DAY_CN[lunarDay % 10]
}

/** 农历月数字 → 月名（正月、八月、腊月…）。 */
export function chineseMonth(lunarMonth: number, isLeap: boolean): string {
  return (isLeap ? '闰' : '') + MONTH_CN[lunarMonth - 1] + '月'
}

/** 日历格里展示的农历短文本：初一显示月名（如「八月」），否则显示日名（如「十五」）。 */
export function lunarCellText(lunar: LunarDate): string {
  return lunar.lunarDay === 1 ? chineseMonth(lunar.lunarMonth, lunar.isLeap) : chineseDay(lunar.lunarDay)
}

// ─── 公历 → 农历 ─────────────────────────────────────────────────────────

/** 公历 `YYYY-MM-DD` → 农历；范围外或非法返回 null。 */
export function solarToLunar(date: string): LunarDate | null {
  const utc = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(utc)) return null
  let offset = Math.floor((utc - LUNAR_EPOCH_UTC) / 86400000)
  if (offset < 0) return null
  let lunarYear = LUNAR_MIN_YEAR
  for (;;) {
    const yearDays = lunarYearDays(lunarYear)
    if (offset < yearDays) break
    offset -= yearDays
    lunarYear += 1
    // 2100 年为表末；其后的农历年无数据（yearDays=0 会死循环，需显式拒绝）
    if (lunarYear > LUNAR_MAX_YEAR + 1) return null
  }
  const months = monthsInYear(lunarYear)
  if (months === null) return null
  let monthIndex = 0
  while (monthIndex < months.length - 1 && offset >= months[monthIndex].days) {
    offset -= months[monthIndex].days
    monthIndex += 1
  }
  const month = months[monthIndex]
  if (offset >= month.days) return null
  return { lunarYear, lunarMonth: month.month, lunarDay: offset + 1, isLeap: month.isLeap }
}

// ─── 农历 → 公历 ─────────────────────────────────────────────────────────

/** 农历（年/月/日/是否闰月）→ 公历 `YYYY-MM-DD`；非法组合返回 null。 */
export function lunarToSolar(lunar: LunarDate): string | null {
  const { lunarYear, lunarMonth, lunarDay, isLeap } = lunar
  const info = infoOf(lunarYear)
  if (info === null || lunarMonth < 1 || lunarMonth > 12 || lunarDay < 1) return null
  const leap = info & 0xf
  if (isLeap && leap !== lunarMonth) return null
  const months = monthsInYear(lunarYear)
  if (months === null) return null
  const target = months.find(m => m.month === lunarMonth && m.isLeap === isLeap)
  if (target === undefined || lunarDay > target.days) return null
  let days = 0
  for (let year = LUNAR_MIN_YEAR; year < lunarYear; year += 1) days += lunarYearDays(year)
  for (const m of months) {
    if (m === target) break
    days += m.days
  }
  days += lunarDay - 1
  const solar = new Date(LUNAR_EPOCH_UTC + days * 86400000)
  // 表末（农历 2100 年腊月可能跨入公历 2101 年初），超出 2101 年拒绝
  if (solar.getUTCFullYear() > 2100) return null
  return solar.toISOString().slice(0, 10)
}

// ─── 传统节日（由农历日期直接推导）──────────────────────────────────────

/** 农历节日表：月 → 日 → 节日名（正月初一春节等）。 */
const LUNAR_FESTIVALS: ReadonlyArray<{ month: number, leap: false, day: number, name: string }> = [
  { month: 1, leap: false, day: 1, name: '春节' },
  { month: 1, leap: false, day: 15, name: '元宵节' },
  { month: 5, leap: false, day: 5, name: '端午节' },
  { month: 7, leap: false, day: 7, name: '七夕' },
  { month: 7, leap: false, day: 15, name: '中元节' },
  { month: 8, leap: false, day: 15, name: '中秋节' },
  { month: 9, leap: false, day: 9, name: '重阳节' },
  { month: 12, leap: false, day: 8, name: '腊八节' },
]

/** 农历日期对应的传统节日名；无返回 null。除夕单独判断（次日是正月初一）。 */
export function lunarFestivalOf(lunar: LunarDate): string | null {
  for (const festival of LUNAR_FESTIVALS) {
    if (!lunar.isLeap && lunar.lunarMonth === festival.month && lunar.lunarDay === festival.day) {
      return festival.name
    }
  }
  return null
}

/** 某公历日是否除夕（次日为正月初一）。 */
export function isLunarNewYearEve(date: string): boolean {
  const next = solarToLunar(nextDay(date))
  return next !== null && next.lunarMonth === 1 && next.lunarDay === 1 && !next.isLeap
}

/** 次日 `YYYY-MM-DD`。 */
export function nextDay(date: string): string {
  const utc = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(utc)) return date
  return new Date(utc + 86400000).toISOString().slice(0, 10)
}
