/**
 * dsh-agenda — 统计视图（需求 §10）。
 *
 * 范围：本周 / 本月 / 自定义（from/to）。指标：日程数、全天日程、定时时长、
 * 待办完成情况、分类聚合（条数 + 时长条形图）。
 */
import { useCallback, useEffect, useState } from 'react'
import type { StatisticsResult } from '../../shared/types.ts'
import { useAgenda } from '../agenda-context.tsx'

type RangeKey = 'week' | 'month' | 'custom'

function monthRange(): { from: string, to: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function weekRangeOf(): { from: string, to: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const weekday = ((now.getUTCDay() + 6) % 7) + 1
  const monday = new Date(now.getTime() - (weekday - 1) * 86400000).toISOString().slice(0, 10)
  const sunday = new Date(now.getTime() + (7 - weekday) * 86400000).toISOString().slice(0, 10)
  return { from: monday, to: sunday }
}

export function StatisticsView(): React.ReactElement {
  const { client } = useAgenda()
  const [rangeKey, setRangeKey] = useState<RangeKey>('week')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [stats, setStats] = useState<StatisticsResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const resolveRange = useCallback((): { from: string, to: string } => {
    if (rangeKey === 'week') return weekRangeOf()
    if (rangeKey === 'month') return monthRange()
    return { from: custom.from || new Date().toISOString().slice(0, 10), to: custom.to || new Date().toISOString().slice(0, 10) }
  }, [rangeKey, custom])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const range = resolveRange()
      const result = await client.op<StatisticsResult>('statistics', { from: range.from, to: range.to })
      setStats(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [client, resolveRange])

  useEffect(() => { void load() }, [load])

  const maxTotal = Math.max(1, ...(stats?.byCategory.map(row => row.eventCount + row.todoCount) ?? [1]))

  return (
    <div>
      <div className="da-row" style={{ marginBottom: 12 }}>
        <div className="da-tabs">
          <button type="button" className={rangeKey === 'week' ? 'da-active' : ''} onClick={() => setRangeKey('week')}>本周</button>
          <button type="button" className={rangeKey === 'month' ? 'da-active' : ''} onClick={() => setRangeKey('month')}>本月</button>
          <button type="button" className={rangeKey === 'custom' ? 'da-active' : ''} onClick={() => setRangeKey('custom')}>自定义</button>
        </div>
        {rangeKey === 'custom' && (
          <>
            <input className="da-input" type="date" value={custom.from} onChange={e => setCustom(prev => ({ ...prev, from: e.target.value }))} />
            <span className="da-dim">至</span>
            <input className="da-input" type="date" value={custom.to} onChange={e => setCustom(prev => ({ ...prev, to: e.target.value }))} />
          </>
        )}
        <span className="da-grow" />
        <button type="button" className="da-btn" onClick={() => void load()} disabled={loading}>{loading ? '统计中…' : '重新统计'}</button>
      </div>

      {error !== '' && <div className="da-card" style={{ color: '#c62828', marginBottom: 12 }}>{error}</div>}

      {stats !== null && (
        <>
          <div className="da-stats-grid" style={{ marginBottom: 14 }}>
            <div className="da-stat-card">
              <div className="da-stat-num">{stats.eventCount}</div>
              <div className="da-stat-label">日程总数</div>
            </div>
            <div className="da-stat-card">
              <div className="da-stat-num">{stats.allDayEventCount}</div>
              <div className="da-stat-label">全天日程</div>
            </div>
            <div className="da-stat-card">
              <div className="da-stat-num">{stats.eventHours}h</div>
              <div className="da-stat-label">定时日程时长</div>
            </div>
            <div className="da-stat-card">
              <div className="da-stat-num">{stats.todoCount}</div>
              <div className="da-stat-label">待办总数</div>
            </div>
            <div className="da-stat-card">
              <div className="da-stat-num">{stats.todoCompleted}</div>
              <div className="da-stat-label">已完成</div>
            </div>
            <div className="da-stat-card">
              <div className="da-stat-num">{Math.round(stats.todoCompletionRate * 100)}%</div>
              <div className="da-stat-label">完成率</div>
            </div>
          </div>

          <div className="da-card">
            <div className="da-section-title" style={{ marginTop: 0 }}>按分类</div>
            {stats.byCategory.length === 0 && <div className="da-empty">该范围没有数据</div>}
            {stats.byCategory.map(row => (
              <div key={row.category} className="da-cat-row">
                <span className="da-cat-name">{row.category}</span>
                <span className="da-bar"><i style={{ width: `${Math.round((row.eventCount + row.todoCount) / maxTotal * 100)}%` }} /></span>
                <span className="da-dim" style={{ minWidth: 130, textAlign: 'right' }}>
                  日程 {row.eventCount} · 待办 {row.todoCount} · {row.eventHours}h
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
