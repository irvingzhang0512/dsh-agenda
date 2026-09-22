/**
 * dsh-agenda — 月视图（需求 §3 Calendar 月视图）。
 *
 * 7 列网格（按设置 weekStart），展示农历标注、法定节假日/调休角标、节日徽章
 * 与当日日程条目（最多 3 条 + 溢出计数）。点击日期弹单日详情。
 */
import { useEffect, useMemo, useState } from 'react'
import type { AgendaEvent, DayInfo } from '../../shared/types.ts'
import { eventDates } from '../../shared/types.ts'
import { eventTimeText, useAgenda, weekdayCn } from '../agenda-context.tsx'
import { DayDetail } from '../components/day-detail.tsx'
import type { EditorMode } from '../components/event-editor.tsx'
import type { TodoEditorMode } from '../components/todo-editor.tsx'

const MAX_CHIPS = 3

export function MonthView({
  initialMonth,
  onEditEvent,
  onNewEvent,
  onEditTodo,
  onNewTodo,
}: {
  initialMonth: string // YYYY-MM
  onEditEvent: (mode: EditorMode) => void
  onNewEvent: (date: string) => void
  onEditTodo: (mode: TodoEditorMode) => void
  onNewTodo: (date: string) => void
}): React.ReactElement {
  const { snapshot, client } = useAgenda()
  const [year, setYear] = useState(() => Number(initialMonth.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(initialMonth.slice(5, 7)))
  const [days, setDays] = useState<DayInfo[]>([])
  const [detailDate, setDetailDate] = useState<string | null>(null)

  const weekStart = snapshot?.settings.weekStart ?? 'monday'

  useEffect(() => {
    let stopped = false
    void client.monthInfo(year, month).then(info => {
      if (!stopped) setDays(info)
    }).catch(() => undefined)
    return () => { stopped = true }
  }, [client, year, month])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const event of snapshot?.events ?? []) {
      for (const date of eventDates(event)) {
        const list = map.get(date) ?? []
        list.push(event)
        map.set(date, list)
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.start.localeCompare(b.start)))
    }
    return map
  }, [snapshot])

  const grid = useMemo(() => {
    if (days.length === 0) return []
    const first = days[0]!
    const firstWeekday = first.weekday // 1=周一
    const offset = weekStart === 'monday' ? firstWeekday - 1 : firstWeekday % 7
    const leading: DayInfo[] = []
    for (let i = offset; i > 0; i -= 1) leading.push({ date: '', weekday: 0, lunarText: '', lunarYear: 0, lunarLeap: false, dayType: 'workday', isToday: false })
    return [...leading, ...days]
  }, [days, weekStart])

  const detailInfo = detailDate !== null ? (days.find(day => day.date === detailDate) ?? null) : null

  const shift = (delta: number): void => {
    let y = year
    let m = month + delta
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setYear(y)
    setMonth(m)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  const badgeOf = (day: DayInfo): React.ReactElement | null => {
    if (day.dayType === 'holiday') return <span className="da-badge da-holiday">休</span>
    if (day.dayType === 'adjusted-workday') return <span className="da-badge da-work">班</span>
    return null
  }

  const renderDay = (day: DayInfo, index: number): React.ReactElement => {
    if (day.date === '') {
      return <div key={`gap-${index}`} className="da-day da-other" />
    }
    const events = eventsByDate.get(day.date) ?? []
    const visible = events.slice(0, MAX_CHIPS)
    const hidden = events.length - visible.length
    const isToday = day.date === todayStr
    return (
      <div
        key={day.date}
        className={`da-day ${isToday ? 'da-today' : ''}`}
        onClick={() => setDetailDate(day.date)}
      >
        <div className="da-day-top">
          <span className="da-day-num">{Number(day.date.slice(8, 10))}</span>
          <span className="da-day-lunar">{day.lunarText}</span>
          <div className="da-day-badges">
            {badgeOf(day)}
            {day.festival !== undefined && day.festival !== '' && <span className="da-badge da-festival">{day.festival}</span>}
          </div>
        </div>
        {visible.map(event => (
          <div
            key={event.id}
            className={`da-ev ${event.allDay ? 'da-allday' : ''}`}
            title={event.title}
            onClick={e => { e.stopPropagation(); onEditEvent({ kind: 'edit', event }) }}
          >
            {event.allDay ? '' : `${timeOf(event.start)} `}{event.title}
          </div>
        ))}
        {hidden > 0 && <div className="da-ev da-more">+{hidden} 项</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="da-cal">
        <div className="da-cal-header">
          <button type="button" className="da-btn" onClick={() => shift(-1)}>‹</button>
          <span className="da-cal-title">{year} 年 {month} 月</span>
          <button type="button" className="da-btn" onClick={() => shift(1)}>›</button>
          <button type="button" className="da-btn" onClick={() => { const now = new Date(); setYear(now.getUTCFullYear()); setMonth(now.getUTCMonth() + 1) }}>本月</button>
        </div>
        <div className="da-grid-head">
          {Array.from({ length: 7 }, (_, i) => {
            const weekday = weekStart === 'monday' ? i + 1 : (i % 7) + 1
            return <div key={weekday}>{weekdayCn(weekday)}</div>
          })}
        </div>
        <div className="da-grid">
          {grid.map((day, index) => renderDay(day, index))}
        </div>
      </div>

      {detailDate !== null && (
        <DayDetail
          date={detailDate}
          dayInfo={detailInfo}
          onClose={() => setDetailDate(null)}
          onEditEvent={onEditEvent}
          onEditTodo={onEditTodo}
          onNewEvent={onNewEvent}
          onNewTodo={onNewTodo}
        />
      )}
    </div>
  )
}

function timeOf(datetime: string): string {
  return datetime.length >= 16 ? datetime.slice(11, 16) : ''
}
