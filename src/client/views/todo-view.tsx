/**
 * dsh-agenda — 待办视图（需求 §4 Todo 全量管理 + V0.2 重复待办）。
 *
 * 数据源为 host 展开的实例列表（重复待办在每个到期日出现一条），
 * 状态过滤（全部/未完成/已完成）+ 按日期分组 + 快速新建 + 勾选实例完成。
 */
import { useEffect, useMemo, useState } from 'react'
import type { AgendaTodo, TodoInstance, TodoRecurrence } from '../../shared/types.ts'
import { cnDate, useAgenda, weekdayCn } from '../agenda-context.tsx'
import type { TodoEditorMode } from '../components/todo-editor.tsx'

type Filter = 'all' | 'pending' | 'completed'

const RECURRENCE_LABEL: Record<TodoRecurrence, string> = {
  daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年',
}

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
  const [instances, setInstances] = useState<TodoInstance[]>([])

  // 实例随快照版本变化重新拉取
  useEffect(() => {
    let stopped = false
    void client.listTodoInstances().then(list => {
      if (!stopped) setInstances(list)
    }).catch(() => undefined)
    return () => { stopped = true }
  }, [client, snapshot?.dataVersion])

  const templates = useMemo(() => {
    const map = new Map<string, AgendaTodo>()
    for (const todo of snapshot?.todos ?? []) map.set(todo.id, todo)
    return map
  }, [snapshot])

  const todos = useMemo(() => {
    const list = instances.filter(instance => {
      if (filter === 'pending') return instance.status === 'pending'
      if (filter === 'completed') return instance.status === 'completed'
      return true
    })
    list.sort((a, b) => (a.status !== b.status ? (a.status === 'pending' ? -1 : 1) : a.date.localeCompare(b.date)))
    return list
  }, [instances, filter])

  const groups = useMemo(() => {
    const map = new Map<string, TodoInstance[]>()
    for (const todo of todos) {
      const list = map.get(todo.date) ?? []
      list.push(todo)
      map.set(todo.date, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [todos])

  const counts = useMemo(() => {
    const all = instances.length
    const pending = instances.filter(instance => instance.status === 'pending').length
    return { all, pending, completed: all - pending }
  }, [instances])

  const addQuick = async (): Promise<void> => {
    const title = quickTitle.trim()
    if (title === '') return
    setQuickTitle('')
    await client.createTodo({ title, date: quickDate }).catch(() => undefined)
  }

  const toggle = async (instance: TodoInstance): Promise<void> => {
    // 完成/重开该日期实例；单次待办 statusDate 无副作用（走模板级分支）
    await client.updateTodo(instance.templateId, {
      status: instance.status === 'completed' ? 'pending' : 'completed',
      statusDate: instance.date,
    }).catch(() => undefined)
  }

  const openEdit = (instance: TodoInstance): void => {
    const template = templates.get(instance.templateId)
    if (template !== undefined) onEditTodo({ kind: 'edit', todo: template })
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
            {list.map(instance => (
              <div key={`${instance.templateId}-${instance.date}`} className={`da-todo-item ${instance.status === 'completed' ? 'da-done' : ''}`}>
                <span className={`da-check ${instance.status === 'completed' ? 'da-checked' : ''}`} onClick={() => void toggle(instance)}>
                  {instance.status === 'completed' ? '✓' : ''}
                </span>
                <span className="da-grow da-todo-title" onClick={() => openEdit(instance)}>{instance.title}</span>
                {instance.recurrence !== undefined && (
                  <span className="da-badge da-weekend" title="重复待办">🔁 {RECURRENCE_LABEL[instance.recurrence]}</span>
                )}
                {instance.category !== undefined && <span className="da-badge da-cat">{instance.category}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
