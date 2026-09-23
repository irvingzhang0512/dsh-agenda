/**
 * dsh-agenda — 待办重复推演（纯函数）。
 *
 * 规则（与需求确认一致）：
 * - 粒度：daily / weekly / monthly / yearly；缺省 = 不重复（单次）。
 * - 公历基准：
 *   - daily 每 +1 天；weekly 每 +7 天；
 *   - monthly 每月同日，基准日为月末（如 31 号）时短月取当月最后一天；
 *   - yearly 每年同月同日，2/29 在平年取 2/28。
 * - 农历基准（calendarType='lunar'，仅 yearly 生效）：每年取农历同月同日换算公历；
 *   闰月基准在无闰年取同名非闰月；当年无对应农历日则跳过该年。
 *
 * 所有日期运算基于 UTC 日历日（与 shared/types.ts 一致）。
 */
import { addDays } from '../shared/types.ts'
import type { CalendarType, TodoRecurrence } from '../shared/types.ts'
import { lunarToSolar } from './lunar.ts'

/** 展开步数上限（待办实例查询上限 10 年，daily 最多约 3650 步；留余量）。 */
const MAX_STEPS = 3700

/** 推演所需的模板字段（AgendaTodo 的结构子集）。 */
export interface TodoBase {
  date: string
  recurrence?: TodoRecurrence
  calendarType?: CalendarType
  lunarYear?: number
  lunarMonth?: number
  lunarDay?: number
  lunarLeap?: boolean
}

/** 某年某月的天数（month 1-12）。 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 农历基准在目标年的公历日期；无对应日返回 null。 */
function lunarOccurrence(year: number, month: number, day: number, isLeap: boolean): string | null {
  let solar = lunarToSolar({ lunarYear: year, lunarMonth: month, lunarDay: day, isLeap })
  if (solar === null && isLeap) {
    // 闰月基准在无闰年：取同名非闰月
    solar = lunarToSolar({ lunarYear: year, lunarMonth: month, lunarDay: day, isLeap: false })
  }
  return solar
}

/** 公历基准的下一实例日期。 */
function nextSolarOccurrence(date: string, recurrence: TodoRecurrence, base: string): string {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const d = Number(date.slice(8, 10))
  switch (recurrence) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addDays(date, 7)
    case 'monthly': {
      const baseDay = Number(base.slice(8, 10))
      const nextM = m === 12 ? 1 : m + 1
      const nextY = m === 12 ? y + 1 : y
      const day = Math.min(baseDay, daysInMonth(nextY, nextM))
      return `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    case 'yearly': {
      const baseM = Number(base.slice(5, 7))
      const baseD = Number(base.slice(8, 10))
      const nextY = y + 1
      const day = baseM === 2 && baseD === 29 && daysInMonth(nextY, 2) < 29 ? 28 : baseD
      return `${nextY}-${String(baseM).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
}

/**
 * 展开一个待办在 [from, to]（含）内的全部实例日期。
 * 单次待办：date 在范围内返回 [date]，否则 []。
 */
export function todoOccurrenceDates(todo: TodoBase, from: string, to: string): string[] {
  const recurrence = todo.recurrence
  if (recurrence === undefined) {
    return todo.date >= from && todo.date <= to ? [todo.date] : []
  }

  // 农历每年：按 lunar 字段逐年换算（不受公历基准日限制）
  if (recurrence === 'yearly' && todo.calendarType === 'lunar') {
    const lYear = todo.lunarYear
    const lMonth = todo.lunarMonth
    const lDay = todo.lunarDay
    if (lYear === undefined || lMonth === undefined || lDay === undefined) return []
    const dates: string[] = []
    let year = lYear
    let guard = 0
    while (guard < MAX_STEPS) {
      const solar = lunarOccurrence(year, lMonth, lDay, todo.lunarLeap === true)
      if (solar !== null) {
        if (solar > to) break
        if (solar >= from) dates.push(solar)
      }
      year += 1
      guard += 1
    }
    return dates
  }

  // 公历：daily / weekly / monthly / yearly
  const dates: string[] = []
  let cursor = todo.date
  let guard = 0
  while (cursor <= to && guard < MAX_STEPS) {
    if (cursor >= from) dates.push(cursor)
    const next = nextSolarOccurrence(cursor, recurrence, todo.date)
    if (next <= cursor) break // 保护死循环
    cursor = next
    guard += 1
  }
  return dates
}
