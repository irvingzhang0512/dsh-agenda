/**
 * dsh-agenda — Todo 编辑器（新建 / 编辑 / 删除）。
 */
import { useState } from 'react'
import type { AgendaTodo, TodoInput } from '../../shared/types.ts'
import { todayISO } from '../../shared/types.ts'
import { useAgenda } from '../agenda-context.tsx'

export type TodoEditorMode =
  | { kind: 'create', date?: string }
  | { kind: 'edit', todo: AgendaTodo }

export function TodoEditor({ mode, onClose }: { mode: TodoEditorMode, onClose: () => void }): React.ReactElement {
  const { client, snapshot } = useAgenda()
  const editing = mode.kind === 'edit' ? mode.todo : null
  const createMode = mode.kind === 'create' ? mode : null
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? createMode?.date ?? todayISO())
  const [category, setCategory] = useState(editing?.category ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = snapshot?.categories ?? []

  const save = async (): Promise<void> => {
    if (title.trim() === '') {
      setError('标题不能为空。')
      return
    }
    setSaving(true)
    setError('')
    try {
      const input: TodoInput = {
        title,
        date,
        category: category.trim() === '' ? undefined : category.trim(),
        description: description.trim() === '' ? undefined : description.trim(),
      }
      if (editing !== null) await client.updateTodo(editing.id, input)
      else await client.createTodo(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (editing === null) return
    if (!window.confirm(`确定删除待办「${editing.title}」吗？`)) return
    setSaving(true)
    try {
      await client.deleteTodo(editing.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="da-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="da-modal-card">
        <h2>{editing !== null ? '编辑待办' : '新建待办'}</h2>
        <div className="da-form">
          <div className="da-field">
            <label>标题 *</label>
            <input className="da-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="da-field">
            <label>日期</label>
            <input className="da-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="da-field">
            <label>分类</label>
            <input className="da-input" list="da-todo-categories" value={category} onChange={e => setCategory(e.target.value)} />
            <datalist id="da-todo-categories">
              {categories.map(path => <option key={path} value={path} />)}
            </datalist>
          </div>
          <div className="da-field">
            <label>备注</label>
            <textarea className="da-textarea" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {error !== '' && <div className="da-dim" style={{ color: '#c62828' }}>{error}</div>}
          <div className="da-row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
            {editing !== null && (
              <button type="button" className="da-btn da-danger" onClick={() => void remove()} disabled={saving}>删除</button>
            )}
            <button type="button" className="da-btn" onClick={onClose} disabled={saving}>取消</button>
            <button type="button" className="da-btn da-primary" onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
