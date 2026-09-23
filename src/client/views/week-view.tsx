/**
 * dsh-agenda — 周视图（需求 §3 Calendar 周视图）。
 *
 * 左侧时间轴 + 7 天列；定时事件按时间绝对定位（顶对齐），全天事件在列顶
 * 单独呈现。点击空白格 = 在该时间新建日程；点击事件 = 编辑。
 */
import { useEffect, useMemo, useState } from 'react'
import type { AgendaEvent, DayInfo } from '../../shared/types.ts'
import { eventDates } from '../../shared/types.ts'
import { useAgenda, weekdayCn } from '../agenda-context.tsx'
import type { EditorMode } from '../components/event-editor.tsx'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const PX_PER_HOUR = 60

function toMinutes(datetime: string): number {
  if (datetime.length < 16) return 0
  return Number(datetime.slice(11, 13)) * 60 + Number(datetime.slice(14, 16))
}

export function WeekView({
  initialDate,
  onEditEvent,
  onNewEvent,
}: {
  initialDate: string // 所在周的任一日期
  onEditEvent: (mode: EditorMode) => void
  onNewEvent: (date: string, hour: string) => void
}): React.ReactElement {
  const { snapshot, client } = useAgenda()
  const [anchor, setAnchor] = useState(initialDate)
  const [info, setInfo] = useState<DayInfo[]>([])

  const weekStart = snapshot?.settings.weekStart ?? 'monday'

  const days = useMemo(() => {
    const base = new Date(`${anchor}T00:00:00Z`)
    const weekday = ((base.getUTCDay() + 6) % 7) + 1 // 1=周一
    const offset = weekStart === 'monday' ? weekday - 1 : weekday % 7
    const monday = new Date(base.getTime() - offset * 86400000)
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10))
  }, [anchor, weekStart])

  useEffect(() => {
    let stopped = false
    void client.rangeInfo(days[0]!, days[6]!).then(list => {
      if (!stopped) setInfo(list)
    }).catch(() => undefined)
    return () => { stopped = true }
  }, [client, days[0], days[6]])

  const infoByDate = useMemo(() => {
    const map = new Map<string, DayInfo>()
    for (const day of info) map.set(day.date, day)
    return map
  }, [info])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const event of snapshot?.events ?? []) {
      for (const date of eventDates(event)) {
        const list = map.get(date) ?? []
        list.push(event)
        map.set(date, list)
      }
    }
    return map
  }, [snapshot])

  const shiftWeek = (delta: number): void => {
    const base = new Date(`${days[0]!}T00:00:00Z`)
    base.setUTCDate(base.getUTCDate() + delta * 7)
    setAnchor(base.toISOString().slice(0, 10))
  }

  const title = (() => {
    const a = Number(days[0]!.slice(8, 10))
    const b = Number(days[6]!.slice(8, 10))
    const year = days[0]!.slice(0, 4)
    const monthA = Number(days[0]!.slice(5, 7))
    const monthB = Number(days[6]!.slice(5, 7))
    if (monthA === monthB) return `${year} 年 ${monthA} 月 ${a}–${b} 日`
    return `${year} 年 ${monthA} 月 ${a} 日 – ${monthB} 月 ${b} 日`
  })()

  const renderEvent = (event: AgendaEvent): React.ReactElement => {
    const isAllDay = event.allDay
    if (isAllDay) {
      return (
        <div
          key={event.id}
          className="da-ev da-allday"
          style={{ marginBottom: 2, cursor: 'pointer' }}
          title={event.title}
          onClick={e => { e.stopPropagation(); onEditEvent({ kind: 'edit', event }) }}
        >
          {event.title}
        </div>
      )
    }
    const startMin = toMinutes(event.start)
    const endRaw = toMinutes(event.end)
    const endMin = endRaw > startMin ? endRaw : startMin + 60
    const top = startMin / 60 * PX_PER_HOUR
    const height = Math.max((endMin - startMin) / 60 * PX_PER_HOUR - 2, 18)
    return (
      <div
        key={event.id}
        className="da-wev"
        style={{ top, height }}
        title={`${event.title}（${event.start.slice(11, 16)}–${event.end.slice(11, 16)}）`}
        onClick={e => { e.stopPropagation(); onEditEvent({ kind: 'edit', event }) }}
      >
        {event.start.slice(11, 16)} {event.title}
      </div>
    )
  }

  const handleSlotClick = (day: string, hour: number): void => {
    onNewEvent(day, `${String(hour).padStart(2, '0')}:00`)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="da-cal-header" style={{ border: 0, padding: '0 0 12px' }}>
        <button type="button" className="da-btn" onClick={() => shiftWeek(-1)}>‹</button>
        <span className="da-cal-title">{title}</span>
        <button type="button" className="da-btn" onClick={() => shiftWeek(1)}>›</button>
        <button type="button" className="da-btn" onClick={() => setAnchor(todayStr)}>本周</button>
      </div>

      <div className="da-week">
        <div className="da-whead">
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 8, fontSize: 11, color: 'var(--da-text-dim)', alignSelf: 'center' }}>时间</div>
          {days.map(day => {
            const info = infoByDate.get(day)
            const isNonWork = info?.dayType === 'weekend' || info?.dayType === 'holiday'
            return (
              <div key={day} className={isNonWork ? 'da-nonwork' : ''} style={day === todayStr ? { background: 'color-mix(in srgb,var(--da-accent) 6%,transparent)' } : undefined}>
                <span className="da-dow">{weekdayCn(info?.weekday ?? 1)}</span>
                <span className="da-dom" style={day === todayStr ? { color: 'var(--da-accent)' } : undefined}>{Number(day.slice(8, 10))}</span>
                {info?.lunarText !== '' && <span className="da-dim" style={{ fontSize: 10 }}>{info?.lunarText}</span>}
                {info?.dayType === 'holiday' && <span className="da-badge da-holiday">休</span>}
                {info?.dayType === 'adjusted-workday' && <span className="da-badge da-work">班</span>}
              </div>
            )
          })}
        </div>

        {/* 全天事件行 */}
        <div className="da-whead">
          <div />
          {days.map(day => (
            <div key={day} style={{ borderTop: '1px solid var(--da-border)', minHeight: 24, display: 'flex', flexDirection: 'column' }}>
              {(eventsByDate.get(day) ?? []).filter(event => event.allDay).map(event => renderEvent(event))}
            </div>
          ))}
        </div>

        {/* 时间轴刻度（左侧槽列） */}
        <div className="da-gutter-hours">
          {HOURS.map(hour => (
            <div key={hour} className="da-hour" style={{ top: hour * PX_PER_HOUR }} title={`${String(hour).padStart(2, '0')}:00`}>
              {`${String(hour).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {/* 时间网格 */}
        {days.map(day => (
          <div key={day} className="da-wcol">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="da-hour"
                style={{ top: hour * PX_PER_HOUR }}
                title={`${Number(day.slice(8, 10))}日 ${String(hour).padStart(2, '0')}:00 新建日程`}
                onClick={() => handleSlotClick(day, hour)}
              />
            ))}
            {(eventsByDate.get(day) ?? []).filter(event => !event.allDay).map(event => renderEvent(event))}
          </div>
        ))}
      </div>
    </div>
  )
}
