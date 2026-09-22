/**
 * dsh-agenda — 客户端共享上下文：快照状态、今天的日历信息与公共工具。
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AgendaSnapshot, DayInfo } from '../shared/types.ts'
import { todayISO } from '../shared/types.ts'
import type { AgendaClient } from './api.ts'

export interface AgendaContextValue {
  client: AgendaClient
  connected: boolean
  error: string | null
  snapshot: AgendaSnapshot | null
  /** 今天的 DayInfo（农历年/节日/日期类型）；未加载时 null。 */
  todayInfo: DayInfo | null
}

const AgendaContext = createContext<AgendaContextValue | null>(null)

/** 视图内取上下文；必须在 AgendaProvider 内。 */
export function useAgenda(): AgendaContextValue {
  const value = useContext(AgendaContext)
  if (value === null) throw new Error('useAgenda 必须在 <AgendaProvider> 内使用。')
  return value
}

/** 应用根 Provider：实例化客户端并订阅快照。 */
export function AgendaProvider({ client, children }: { client: AgendaClient, children: ReactNode }): React.ReactElement {
  const [connected, setConnected] = useState(client.connected)
  const [snapshot, setSnapshot] = useState<AgendaSnapshot | null>(client.snapshot)
  const [error, setError] = useState<string | null>(client.error)
  const [todayInfo, setTodayInfo] = useState<DayInfo | null>(null)

  useEffect(() => {
    const sync = (): void => {
      setConnected(client.connected)
      setSnapshot(client.snapshot)
      setError(client.error)
    }
    sync()
    return client.subscribe(sync)
  }, [client])

  // 预取今天的日历信息（农历年 / 节日 / 日期类型）
  useEffect(() => {
    let stopped = false
    void client.rangeInfo(todayISO(), todayISO()).then(days => {
      if (!stopped && days.length === 1) setTodayInfo(days[0] ?? null)
    }).catch(() => undefined)
    return () => { stopped = true }
  }, [client, snapshot?.dataVersion])

  const value: AgendaContextValue = { client, connected, error, snapshot, todayInfo }
  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>
}

// ─── 展示工具（纯函数）────────────────────────────────────────────────────

const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

/** 1=周一 … 7=周日 → 中文。 */
export function weekdayCn(weekday: number): string {
  return WEEKDAY_CN[(weekday - 1 + 7) % 7] ?? ''
}

/** `YYYY-MM-DD` → `M月D日`。 */
export function cnDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}月${Number(d)}日`
}

/** `YYYY-MM-DDTHH:mm` → `HH:mm`；date-only 返回 ''。 */
export function timeOf(datetime: string): string {
  return datetime.length >= 16 ? datetime.slice(11, 16) : ''
}

/** 事件在视图中的时间段文本。 */
export function eventTimeText(event: { start: string, end: string, allDay: boolean }): string {
  if (event.allDay) return '全天'
  const start = timeOf(event.start)
  const end = timeOf(event.end)
  const startDay = event.start.slice(0, 10)
  const endDay = event.end.slice(0, 10)
  if (startDay === endDay) return `${start} – ${end}`
  return `${startDay} ${start} → ${endDay} ${end}`
}

/** 周区间（按 weekStart）：返回 [周一…周日] 的日期。 */
export function weekRange(date: string, weekStart: 'monday' | 'sunday'): string[] {
  const base = new Date(`${date}T00:00:00Z`)
  const weekday = ((base.getUTCDay() + 6) % 7) + 1 // 1=周一
  const offset = weekStart === 'monday' ? weekday - 1 : weekday % 7
  const monday = new Date(base.getTime() - offset * 86400000)
  const days: string[] = []
  for (let i = 0; i < 7; i += 1) {
    days.push(new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10))
  }
  return days
}
