/**
 * dsh-agenda — Todo 编辑器（新建 / 编辑 / 删除）。
 *
 * 支持重复（每天/每周/每月/每年）；「每年」重复可切换农历基准（如每年农历生日），
 * 农历基准保留原始农历字段并自动换算公历日期。
 */
import { useState } from 'react'
import type { AgendaTodo, TodoInput, TodoRecurrence } from '../../shared/types.ts'
import { todayISO } from '../../shared/types.ts'
import { useAgenda } from '../agenda-context.tsx'

export type TodoEditorMode =
  | { kind: 'create', date?: string }
  | { kind: 'edit', todo: AgendaTodo }

const RECURRENCE_OPTIONS: Array<{ value: TodoRecurrence | 'none', label: string }> = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
]

export function TodoEditor({ mode, onClose }: { mode: TodoEditorMode, onClose: () => void }): React.ReactElement {
  const { client, snapshot, todayInfo } = useAgenda()
  const editing = mode.kind === 'edit' ? mode.todo : null
  const createMode = mode.kind === 'create' ? mode : null
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? createMode?.date ?? todayISO())
  const [category, setCategory] = useState(editing?.category ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [recurrence, setRecurrence] = useState<TodoRecurrence | 'none'>(editing?.recurrence ?? 'none')
  const [isLunar, setIsLunar] = useState(editing?.calendarType === 'lunar')
  const [lunarYear, setLunarYear] = useState(editing?.lunarYear ?? todayInfo?.lunarYear ?? Number(todayISO().slice(0, 4)))
  const [lunarMonth, setLunarMonth] = useState(editing?.lunarMonth ?? 1)
  const [lunarDay, setLunarDay] = useState(editing?.lunarDay ?? 1)
  const [lunarLeap, setLunarLeap] = useState(editing?.lunarLeap ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = snapshot?.categories ?? []

  const buildInput = (): TodoInput => {
    const input: TodoInput = {
      title,
      date,
      ...(category.trim() !== '' ? { category: category.trim() } : {}),
      ...(description.trim() !== '' ? { description: description.trim() } : {}),
      ...(recurrence !== 'none' ? { recurrence } : {}),
    }
    if (recurrence === 'yearly' && isLunar) {
      input.calendarType = 'lunar'
      input.lunarYear = Number(lunarYear)
      input.lunarMonth = Number(lunarMonth)
      input.lunarDay = Number(lunarDay)
      input.lunarLeap = lunarLeap
    }
    return input
  }

  const save = async (): Promise<void> => {
    if (title.trim() === '') {
      setError('标题不能为空。')
      return
    }
    setSaving(true)
    setError('')
    try {
      const input = buildInput()
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
            <label>重复</label>
            <div className="da-inline">
              <select className="da-select" value={recurrence} onChange={e => setRecurrence(e.target.value as TodoRecurrence | 'none')}>
                {RECURRENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {recurrence === 'yearly' && (
                <label className="da-row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={isLunar} onChange={e => setIsLunar(e.target.checked)} />
                  农历基准（如每年农历生日）
                </label>
              )}
            </div>
          </div>

          {recurrence === 'yearly' && isLunar ? (
            <div className="da-field">
              <label>农历日期（每年按农历重复，自动换算公历）</label>
              <div className="da-inline">
                <input className="da-input" type="number" min={1900} max={2099} style={{ width: 90 }} value={lunarYear} onChange={e => setLunarYear(Number(e.target.value))} />
                <span className="da-dim">年</span>
                <input className="da-input" type="number" min={1} max={12} style={{ width: 70 }} value={lunarMonth} onChange={e => setLunarMonth(Number(e.target.value))} />
                <span className="da-dim">月</span>
                <input className="da-input" type="number" min={1} max={30} style={{ width: 70 }} value={lunarDay} onChange={e => setLunarDay(Number(e.target.value))} />
                <span className="da-dim">日</span>
                <label className="da-row" style={{ gap: 6, marginLeft: 8 }}>
                  <input type="checkbox" checked={lunarLeap} onChange={e => setLunarLeap(e.target.checked)} />
                  闰月
                </label>
              </div>
            </div>
          ) : (
            <div className="da-field">
              <label>日期</label>
              <input className="da-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}

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
          {error !== '' && <div className="da-dim" style={{ color: 'var(--da-holiday)' }}>{error}</div>}
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
