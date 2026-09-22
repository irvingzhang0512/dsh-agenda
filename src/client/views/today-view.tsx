/**
 * dsh-agenda — Today 当日视图（需求 §4，高频入口）。
 *
 * 展示：当前日期 / 星期 / 农历 / 今日日程（全天在前、按时间序）/ 今日待办
 * （未完成在前，可勾选完成）。右上角支持快速新建日程 / 待办。
 */
import { useMemo, useState } from 'react'
import type { AgendaEvent } from '../../shared/types.ts'
import { eventDates, todayISO } from '../../shared/types.ts'
import { cnDate, eventTimeText, useAgenda, weekdayCn } from '../agenda-context.tsx'
import type { EditorMode } from '../components/event-editor.tsx'
import type { TodoEditorMode } from '../components/todo-editor.tsx'

export function TodayView({
  onEditEvent,
  onNewEvent,
  onEditTodo,
  onNewTodo,
}: {
  onEditEvent: (mode: EditorMode) => void
  onNewEvent: (date: string) => void
  onEditTodo: (mode: TodoEditorMode) => void
  onNewTodo: (date: string) => void
}): React.ReactElement {
  const { snapshot, todayInfo, client } = useAgenda()
  const [quickTodo, setQuickTodo] = useState('')
  const today = todayISO()

  const dayEvents = useMemo(() => {
    return (snapshot?.events ?? [])
      .filter(event => eventDates(event).includes(today))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return a.start.localeCompare(b.start)
      })
  }, [snapshot, today])

  const dayTodos = useMemo(() => {
    return (snapshot?.todos ?? [])
      .filter(todo => todo.date === today)
      .sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === 'pending' ? -1 : 1))
  }, [snapshot, today])

  const pendingCount = dayTodos.filter(todo => todo.status === 'pending').length
  const completedCount = dayTodos.length - pendingCount

  const holiday = todayInfo?.holidayName !== undefined ? todayInfo.holidayName : todayInfo?.festival

  const addQuickTodo = async (): Promise<void> => {
    const title = quickTodo.trim()
    if (title === '') return
    setQuickTodo('')
    await client.createTodo({ title, date: today }).catch(() => undefined)
  }

  const toggleTodo = async (id: string, completed: boolean): Promise<void> => {
    await client.updateTodo(id, { status: completed ? 'pending' : 'completed' }).catch(() => undefined)
  }

  const renderEvent = (event: AgendaEvent): React.ReactElement => (
    <div key={event.id} className={`da-event-item ${event.allDay ? 'da-allday' : ''}`} onClick={() => onEditEvent({ kind: 'edit', event })}>
      <span className="da-time">{eventTimeText(event)}</span>
      <div className="da-grow">
        <div className="da-title">{event.title}</div>
        {(event.category !== undefined || event.location !== undefined) && (
          <div className="da-row" style={{ gap: 4, marginTop: 2 }}>
            {event.category !== undefined && <span className="da-badge da-cat">{event.category}</span>}
            {event.location !== undefined && <span className="da-dim">{event.location}</span>}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="da-date-head">
        <span className="da-big">{cnDate(today)}</span>
        <span className="da-sub">{weekdayCn(todayInfo?.weekday ?? 1)}</span>
        {todayInfo !== null && <span className="da-sub">农历{todayInfo.lunarText}{todayInfo.lunarLeap ? '（闰）' : ''}</span>}
        {holiday !== undefined && <span className="da-badge da-festival">{holiday}</span>}
        <span className="da-grow" />
        <button type="button" className="da-btn da-primary" onClick={() => onNewEvent(today)}>＋ 日程</button>
        <button type="button" className="da-btn" onClick={() => onNewTodo(today)}>＋ 待办</button>
      </div>

      <div className="da-card" style={{ marginBottom: 14 }}>
        <div className="da-section-title" style={{ marginTop: 0 }}>今日日程（{dayEvents.length}）</div>
        {dayEvents.length === 0
          ? <div className="da-empty">今天没有日程安排</div>
          : <div className="da-list">{dayEvents.map(renderEvent)}</div>}
      </div>

      <div className="da-card">
        <div className="da-section-title" style={{ marginTop: 0 }}>
          今日待办（{pendingCount} 未完成 / {completedCount} 已完成）
        </div>
        {dayTodos.length === 0 && <div className="da-empty">今天没有待办</div>}
        <div className="da-list">
          {dayTodos.map(todo => (
            <div key={todo.id} className={`da-todo-item ${todo.status === 'completed' ? 'da-done' : ''}`}>
              <span className={`da-check ${todo.status === 'completed' ? 'da-checked' : ''}`} onClick={() => void toggleTodo(todo.id, todo.status === 'completed')}>
                {todo.status === 'completed' ? '✓' : ''}
              </span>
              <span className="da-grow da-todo-title" onClick={() => onEditTodo({ kind: 'edit', todo })}>{todo.title}</span>
              {todo.category !== undefined && <span className="da-badge da-cat">{todo.category}</span>}
            </div>
          ))}
        </div>
        <div className="da-row" style={{ marginTop: 10 }}>
          <input
            className="da-input da-grow"
            placeholder="快速添加待办，回车保存"
            value={quickTodo}
            onChange={e => setQuickTodo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addQuickTodo() }}
          />
          <button type="button" className="da-btn" onClick={() => void addQuickTodo()}>添加</button>
        </div>
      </div>
    </div>
  )
}
