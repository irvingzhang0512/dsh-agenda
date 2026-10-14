/**
 * dsh-agenda — 搜索视图（需求 §11）。
 *
 * 联合搜索日程与待办（标题 / 备注 / 分类），可选日期范围过滤。
 */
import { useEffect, useState } from 'react'
import { usePersistentState } from '../persistent-state.ts'
import type { SearchResult } from '../../shared/types.ts'
import { eventTimeText, useAgenda } from '../agenda-context.tsx'
import type { EditorMode } from '../components/event-editor.tsx'
import type { TodoEditorMode } from '../components/todo-editor.tsx'

export function SearchView({
  onEditEvent,
  onEditTodo,
}: {
  onEditEvent: (mode: EditorMode) => void
  onEditTodo: (mode: TodoEditorMode) => void
}): React.ReactElement {
  const { client, snapshot, connected } = useAgenda()
  const [query, setQuery] = usePersistentState('search.query', '')
  const [eventsFrom, setEventsFrom] = usePersistentState('search.eventsFrom', '')
  const [eventsTo, setEventsTo] = usePersistentState('search.eventsTo', '')
  const [todosFrom, setTodosFrom] = usePersistentState('search.todosFrom', '')
  const [todosTo, setTodosTo] = usePersistentState('search.todosTo', '')
  const [result, setResult] = usePersistentState<SearchResult | null>('search.result', null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [submitted, setSubmitted] = usePersistentState<Record<string, unknown> | null>('search.submitted', null)
  useEffect(() => {
    if (!submitted) return
    if (!connected) return
    let stopped = false
    setLoading(true); setError('')
    void client.op<SearchResult>('search', submitted).then(found => { if (!stopped) setResult(found) }).catch(err => { if (!stopped) setError(String(err.message)) }).finally(() => { if (!stopped) setLoading(false) })
    return () => { stopped = true }
  }, [client, connected, submitted, snapshot?.dataVersion])

  const search = async (): Promise<void> => {
    const q = query.trim()
    if (q === '') {
      setError('请输入搜索词。')
      return
    }
    setSubmitted({
      query: q,
      eventsFrom: eventsFrom || undefined, eventsTo: eventsTo || undefined,
      todosFrom: todosFrom || undefined, todosTo: todosTo || undefined,
    })
  }

  return (
    <div>
      <div className="da-card">
        <div className="da-search-box">
          <input
            className="da-input"
            placeholder="搜索日程 / 待办（标题、备注、分类）"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void search() }}
            autoFocus
          />
          <button type="button" className="da-btn da-primary" onClick={() => void search()} disabled={loading}>{loading ? '搜索中…' : '搜索'}</button>
        </div>
        <div className="da-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="da-dim">日程范围</span>
          <input className="da-input" type="date" value={eventsFrom} onChange={e => setEventsFrom(e.target.value)} />
          <span className="da-dim">至</span>
          <input className="da-input" type="date" value={eventsTo} onChange={e => setEventsTo(e.target.value)} />
          <span className="da-dim" style={{ marginLeft: 8 }}>待办范围</span>
          <input className="da-input" type="date" value={todosFrom} onChange={e => setTodosFrom(e.target.value)} />
          <span className="da-dim">至</span>
          <input className="da-input" type="date" value={todosTo} onChange={e => setTodosTo(e.target.value)} />
        </div>
      </div>

      {error !== '' && <div className="da-card" style={{ color: '#c62828', marginTop: 12 }}>{error}</div>}

      {result !== null && (
        <>
          <div className="da-section-title">日程（{result.eventTotal} 条{result.truncated ? '，已截断' : ''}）</div>
          {result.events.length === 0 ? <div className="da-card"><div className="da-empty">未找到匹配的日程</div></div> : (
            <div className="da-card da-list">
              {result.events.map(event => (
                <div key={event.id} className={`da-event-item ${event.allDay ? 'da-allday' : ''}`} onClick={() => onEditEvent({ kind: 'edit', event })}>
                  <span className="da-time">{eventTimeText(event)}</span>
                  <div className="da-grow">
                    <div className="da-title">{event.title}</div>
                    <div className="da-row" style={{ gap: 4, marginTop: 2 }}>
                      {event.category !== undefined && <span className="da-badge da-cat">{event.category}</span>}
                      {event.description !== undefined && <span className="da-dim">{event.description}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="da-section-title">待办（{result.todoTotal} 条{result.truncated ? '，已截断' : ''}）</div>
          {result.todos.length === 0 ? <div className="da-card"><div className="da-empty">未找到匹配的待办</div></div> : (
            <div className="da-card da-list">
              {result.todos.map(todo => (
                <div key={todo.id} className={`da-todo-item ${todo.status === 'completed' ? 'da-done' : ''}`} onClick={() => onEditTodo({ kind: 'edit', todo })}>
                  <span className="da-grow da-todo-title">{todo.title}</span>
                  <span className="da-dim">{todo.date}</span>
                  {todo.category !== undefined && <span className="da-badge da-cat">{todo.category}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
