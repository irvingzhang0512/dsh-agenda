/**
 * dsh-agenda — Event 编辑器（新建 / 编辑 / 删除）。
 *
 * 支持公历 / 农历两条路径（需求 §5/§7），农历事件保留原始农历字段；
 * 分类为路径式多级选择 + 自由输入（首次引用自动登记）。
 */
import { useEffect, useState } from 'react'
import type { AgendaEvent, CalendarType, EventInput } from '../../shared/types.ts'
import { todayISO } from '../../shared/types.ts'
import { useAgenda } from '../agenda-context.tsx'

export type EditorMode =
  | { kind: 'create', defaults?: EventInput, date?: string, hour?: string }
  | { kind: 'edit', event: AgendaEvent }

export function EventEditor({ mode, onClose }: { mode: EditorMode, onClose: () => void }): React.ReactElement {
  const { client, snapshot, todayInfo } = useAgenda()
  const editing = mode.kind === 'edit' ? mode.event : null
  const createMode = mode.kind === 'create' ? mode : null

  const [title, setTitle] = useState(editing?.title ?? '')
  const [calendarType, setCalendarType] = useState<CalendarType>(editing?.calendarType ?? 'solar')
  const [allDay, setAllDay] = useState(editing?.allDay ?? false)
  // 公历
  const [startDate, setStartDate] = useState(editing?.start.slice(0, 10) ?? createMode?.date ?? todayISO())
  const [startTime, setStartTime] = useState(() => editing !== null && !editing.allDay ? editing.start.slice(11, 16) : createMode?.hour ?? '09:00')
  const [endDate, setEndDate] = useState(editing?.end.slice(0, 10) ?? createMode?.date ?? todayISO())
  const [endTime, setEndTime] = useState(() => editing !== null && !editing.allDay ? editing.end.slice(11, 16) : '10:00')
  // 农历
  const [lunarYear, setLunarYear] = useState(() => editing?.lunarYear ?? todayInfo?.lunarYear ?? Number(todayISO().slice(0, 4)))
  const [lunarMonth, setLunarMonth] = useState(() => editing?.lunarMonth ?? 1)
  const [lunarDay, setLunarDay] = useState(() => editing?.lunarDay ?? 1)
  const [lunarLeap, setLunarLeap] = useState(() => editing?.lunarLeap ?? false)
  const [lunarStartTime, setLunarStartTime] = useState(() => editing?.lunarMonth !== undefined && !editing.allDay ? editing.start.slice(11, 16) : '09:00')
  const [lunarEndTime, setLunarEndTime] = useState(() => editing?.lunarMonth !== undefined && !editing.allDay ? editing.end.slice(11, 16) : '10:00')

  const [category, setCategory] = useState(editing?.category ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // create 模式跟随传入日期（视图点击时更新）
    if (createMode !== null && createMode.date !== undefined) {
      setStartDate(createMode.date)
      setEndDate(createMode.date)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const categories = snapshot?.categories ?? []

  const buildInput = (): EventInput => {
    const base: EventInput = {
      title,
      calendarType,
      allDay,
      category: category.trim() === '' ? undefined : category.trim(),
      location: location.trim() === '' ? undefined : location.trim(),
      description: description.trim() === '' ? undefined : description.trim(),
    }
    if (calendarType === 'lunar') {
      base.lunarYear = Number(lunarYear)
      base.lunarMonth = Number(lunarMonth)
      base.lunarDay = Number(lunarDay)
      base.lunarLeap = lunarLeap
      if (!allDay) {
        base.startTime = lunarStartTime
        base.endTime = lunarEndTime
      }
      return base
    }
    base.start = allDay ? startDate : `${startDate}T${startTime || '09:00'}`
    base.end = allDay ? endDate : `${endDate}T${endTime || '10:00'}`
    return base
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
      if (editing !== null) await client.updateEvent(editing.id, { ...input })
      else await client.createEvent(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (editing === null) return
    if (!window.confirm(`确定删除日程「${editing.title}」吗？`)) return
    setSaving(true)
    try {
      await client.deleteEvent(editing.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="da-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="da-modal-card">
        <h2>{editing !== null ? '编辑日程' : '新建日程'}</h2>
        <div className="da-form">
          <div className="da-field">
            <label>标题 *</label>
            <input className="da-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="例如：算法评审" />
          </div>

          <div className="da-inline">
            <div className="da-tabs">
              <button type="button" className={calendarType === 'solar' ? 'da-active' : ''} onClick={() => setCalendarType('solar')}>公历</button>
              <button type="button" className={calendarType === 'lunar' ? 'da-active' : ''} onClick={() => setCalendarType('lunar')}>农历</button>
            </div>
            <label className="da-row" style={{ gap: 6 }}>
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              全天
            </label>
          </div>

          {calendarType === 'solar' ? (
            <>
              <div className="da-field">
                <label>开始</label>
                <div className="da-inline">
                  <input className="da-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  {!allDay && <input className="da-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />}
                </div>
              </div>
              <div className="da-field">
                <label>结束</label>
                <div className="da-inline">
                  <input className="da-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  {!allDay && <input className="da-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="da-field">
                <label>农历日期</label>
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
                <span className="da-dim">农历事件会保留原始农历信息，并换算为公历显示。</span>
              </div>
              {!allDay && (
                <div className="da-field">
                  <label>时间（农历事件按当日换算）</label>
                  <div className="da-inline">
                    <input className="da-input" type="time" value={lunarStartTime} onChange={e => setLunarStartTime(e.target.value)} />
                    <span className="da-dim">至</span>
                    <input className="da-input" type="time" value={lunarEndTime} onChange={e => setLunarEndTime(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="da-field">
            <label>分类（路径式，如 工作/防干烧/算法）</label>
            <input className="da-input" list="da-category-options" value={category} onChange={e => setCategory(e.target.value)} placeholder="选择或输入新分类" />
            <datalist id="da-category-options">
              {categories.map(path => <option key={path} value={path} />)}
            </datalist>
          </div>
          <div className="da-field">
            <label>地点</label>
            <input className="da-input" value={location} onChange={e => setLocation(e.target.value)} />
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
