/**
 * dsh-agenda — 单日详情（月视图点击日期弹出）。
 *
 * 展示当天日程（全天在前、定时按时间序）与待办，并提供新建日程 / 新建待办入口。
 * 数据全部来自共享快照，无额外请求。
 */
import type { AgendaEvent, DayInfo } from '../../shared/types.ts'
import { eventDates, todayISO } from '../../shared/types.ts'
import { cnDate, eventTimeText, useAgenda, weekdayCn } from '../agenda-context.tsx'
import type { EditorMode } from './event-editor.tsx'
import type { TodoEditorMode } from './todo-editor.tsx'

export function DayDetail({
  date,
  dayInfo,
  onClose,
  onEditEvent,
  onEditTodo,
  onNewEvent,
  onNewTodo,
}: {
  date: string
  dayInfo: DayInfo | null
  onClose: () => void
  onEditEvent: (mode: EditorMode) => void
  onEditTodo: (mode: TodoEditorMode) => void
  onNewEvent: (date: string) => void
  onNewTodo: (date: string) => void
}): React.ReactElement {
  const { snapshot } = useAgenda()

  const events = (snapshot?.events ?? []).filter(event => eventDates(event).includes(date))
  const allDayEvents = events.filter(event => event.allDay)
  const timedEvents = events.filter(event => !event.allDay).sort((a, b) => a.start.localeCompare(b.start))
  const todos = (snapshot?.todos ?? []).filter(todo => todo.date === date)

  const renderEvent = (event: AgendaEvent): React.ReactElement => (
    <div key={event.id} className={`da-event-item ${event.allDay ? 'da-allday' : ''}`} onClick={() => onEditEvent({ kind: 'edit', event })}>
      <span className="da-time">{eventTimeText(event)}</span>
      <div className="da-grow">
        <div className="da-title">{event.title}</div>
        <div className="da-row" style={{ gap: 4, marginTop: 2 }}>
          {event.calendarType === 'lunar' && event.lunarMonth !== undefined && (
            <span className="da-badge da-festival">农历{event.lunarLeap ? '闰' : ''}{event.lunarMonth}月{event.lunarDay}日</span>
          )}
          {event.category !== undefined && <span className="da-badge da-cat">{event.category}</span>}
          {event.location !== undefined && <span className="da-dim">{event.location}</span>}
        </div>
        {event.description !== undefined && event.description !== '' && <div className="da-dim">{event.description}</div>}
      </div>
    </div>
  )

  const holiday = dayInfo?.holidayName !== undefined
    ? dayInfo.holidayName
    : dayInfo?.festival !== undefined ? dayInfo.festival : undefined

  return (
    <div className="da-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="da-modal-card">
        <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          {cnDate(date)}
          <span className="da-dim">{weekdayCn(dayInfo?.weekday ?? 1)}</span>
          {dayInfo !== null && <span className="da-dim">{dayInfo.lunarText}{dayInfo.lunarLeap ? '（闰）' : ''}</span>}
          {holiday !== undefined && <span className="da-badge da-festival">{holiday}</span>}
          {date === todayISO() && <span className="da-badge da-ok">今天</span>}
        </h2>

        <div className="da-row" style={{ gap: 8, marginBottom: 10 }}>
          <button type="button" className="da-btn da-primary" onClick={() => { onClose(); onNewEvent(date) }}>＋ 新建日程</button>
          <button type="button" className="da-btn" onClick={() => { onClose(); onNewTodo(date) }}>＋ 新建待办</button>
        </div>

        <div className="da-section-title">日程（{events.length}）</div>
        {events.length === 0 ? <div className="da-empty">当天没有日程</div> : (
          <div className="da-list">
            {allDayEvents.map(renderEvent)}
            {timedEvents.map(renderEvent)}
          </div>
        )}

        <div className="da-section-title">待办（{todos.length}）</div>
        {todos.length === 0 ? <div className="da-empty">当天没有待办</div> : (
          <div className="da-list">
            {todos.map(todo => (
              <div key={todo.id} className={`da-todo-item ${todo.status === 'completed' ? 'da-done' : ''}`}>
                <span className="da-grow da-todo-title" onClick={() => onEditTodo({ kind: 'edit', todo })}>{todo.title}</span>
                {todo.category !== undefined && <span className="da-badge da-cat">{todo.category}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
