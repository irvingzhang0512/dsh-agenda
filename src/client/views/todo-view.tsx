/**
 * dsh-agenda — 待办视图（需求 §4 Todo 全量管理）。
 *
 * 状态过滤（全部/未完成/已完成）+ 按日期分组列表 + 快速新建 + 勾选完成。
 */
import { useMemo, useState } from 'react'
import type { AgendaTodo } from '../../shared/types.ts'
import { cnDate, useAgenda, weekdayCn } from '../agenda-context.tsx'
import type { TodoEditorMode } from '../components/todo-editor.tsx'

type Filter = 'all' | 'pending' | 'completed'

export function TodoView({
  onEditTodo,
  onNewTodo,
}: {
  onEditTodo: (mode: TodoEditorMode) => void
  onNewTodo: (date?: string) => void
}): React.ReactElement {
  const { snapshot, client } = useAgenda()
  const [filter, setFilter] = useState<Filter>('pending')
  const [quickTitle, setQuickTitle] = useState('')
  const [quickDate, setQuickDate] = useState(() => new Date().toISOString().slice(0, 10))

  const todos = useMemo(() => {
    const list = (snapshot?.todos ?? []).filter(todo => {
      if (filter === 'pending') return todo.status === 'pending'
      if (filter === 'completed') return todo.status === 'completed'
      return true
    })
    list.sort((a, b) => (a.status !== b.status ? (a.status === 'pending' ? -1 : 1) : a.date.localeCompare(b.date)))
    return list
  }, [snapshot, filter])

  const groups = useMemo(() => {
    const map = new Map<string, AgendaTodo[]>()
    for (const todo of todos) {
      const list = map.get(todo.date) ?? []
      list.push(todo)
      map.set(todo.date, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [todos])

  const counts = useMemo(() => {
    const all = snapshot?.todos ?? []
    const pending = all.filter(todo => todo.status === 'pending').length
    return { all: all.length, pending, completed: all.length - pending }
  }, [snapshot])

  const addQuick = async (): Promise<void> => {
    const title = quickTitle.trim()
    if (title === '') return
    setQuickTitle('')
    await client.createTodo({ title, date: quickDate }).catch(() => undefined)
  }

  const toggle = async (todo: AgendaTodo): Promise<void> => {
    await client.updateTodo(todo.id, { status: todo.status === 'completed' ? 'pending' : 'completed' }).catch(() => undefined)
  }

  const weekdayOf = (date: string): number => {
    return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
  }

  return (
    <div>
      <div className="da-row" style={{ marginBottom: 12 }}>
        <div className="da-tabs">
          <button type="button" className={filter === 'pending' ? 'da-active' : ''} onClick={() => setFilter('pending')}>未完成 {counts.pending}</button>
          <button type="button" className={filter === 'completed' ? 'da-active' : ''} onClick={() => setFilter('completed')}>已完成 {counts.completed}</button>
          <button type="button" className={filter === 'all' ? 'da-active' : ''} onClick={() => setFilter('all')}>全部 {counts.all}</button>
        </div>
        <span className="da-grow" />
        <button type="button" className="da-btn da-primary" onClick={() => onNewTodo(undefined)}>＋ 新建待办</button>
      </div>

      <div className="da-card" style={{ marginBottom: 14 }}>
        <div className="da-row">
          <input className="da-input da-grow" placeholder="快速添加待办标题" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addQuick() }} />
          <input className="da-input" type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} />
          <button type="button" className="da-btn" onClick={() => void addQuick()}>添加</button>
        </div>
      </div>

      {groups.length === 0 ? <div className="da-card"><div className="da-empty">没有符合条件的待办</div></div> : groups.map(([date, list]) => (
        <div key={date} className="da-card" style={{ marginBottom: 10 }}>
          <div className="da-row" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{cnDate(date)}</span>
            <span className="da-dim">{weekdayCn(weekdayOf(date))}</span>
            <span className="da-grow" />
            <span className="da-dim">{list.filter(todo => todo.status === 'pending').length} 未完成</span>
          </div>
          <div className="da-list">
            {list.map(todo => (
              <div key={todo.id} className={`da-todo-item ${todo.status === 'completed' ? 'da-done' : ''}`}>
                <span className={`da-check ${todo.status === 'completed' ? 'da-checked' : ''}`} onClick={() => void toggle(todo)}>
                  {todo.status === 'completed' ? '✓' : ''}
                </span>
                <span className="da-grow da-todo-title" onClick={() => onEditTodo({ kind: 'edit', todo })}>{todo.title}</span>
                {todo.category !== undefined && <span className="da-badge da-cat">{todo.category}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
