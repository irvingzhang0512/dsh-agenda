import { useEffect, useState } from 'react'
import type { AgendaClient } from './api.ts'
import { AgendaProvider, useAgenda } from './agenda-context.tsx'
import { usePersistentState } from './persistent-state.ts'
import { Button, SegmentedTabs } from './primitives.ts'

function SettingsContent(): React.ReactElement {
  const { client, snapshot, connected } = useAgenda()
  const [draft, setDraft] = usePersistentState('settings.draft', { weekStart: snapshot?.settings.weekStart ?? 'monday', revision: snapshot?.settingsRevision ?? '', dirty: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (snapshot && !draft.dirty) setDraft({ weekStart: snapshot.settings.weekStart, revision: snapshot.settingsRevision, dirty: false })
  }, [snapshot?.settingsRevision])
  const save = async (): Promise<void> => {
    setSaving(true); setError('')
    try {
      const result = await client.updateSettings({ weekStart: draft.weekStart }, draft.revision)
      setDraft({ weekStart: result.settings.weekStart, revision: result.settingsRevision, dirty: false })
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setSaving(false) }
  }
  const reload = async (): Promise<void> => {
    if (draft.dirty && !window.confirm('放弃未保存的周起始日修改并读取最新设置吗？')) return
    try {
      await client.refresh()
      const latest = client.snapshot!
      setDraft({ weekStart: latest.settings.weekStart, revision: latest.settingsRevision, dirty: false }); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }
  const data = snapshot?.holidayData
  return <section className="da-root da-settings">
    <h2>Irving · 日程与待办</h2>
    <p>周起始日默认为周一，保存后立即更新月历和周历。</p>
    <SegmentedTabs label="周起始日" items={[{ value: 'monday', label: '周一' }, { value: 'sunday', label: '周日' }]} value={draft.weekStart} onChange={value => { if (!saving) setDraft({ ...draft, weekStart: value as 'monday' | 'sunday', dirty: true }) }} />
    <div className="da-row"><Button disabled={!connected || saving || !draft.dirty} onClick={() => void save()}>{saving ? '保存中…' : '保存设置'}</Button><Button disabled={!connected || saving} onClick={() => void reload()}>重新读取</Button></div>
    {error && <p role="alert">{error}</p>}
    {!connected && <p>日程服务尚未连接，草稿已保留。</p>}
    <h3>节假日资料</h3>
    <p>离线节假日库：chinese-days {data?.packageVersion ?? '载入中'}</p>
    <p>已收录年份：{data?.supportedYears.join('、') || '暂无'}</p>
    <p>本地覆盖年份：{data?.localOverrideYears.join('、') || '无'}</p>
    {!!data?.legacyFullYears.length && <p>整年本地资料优先：{data.legacyFullYears.join('、')}</p>}
    {data?.warnings.map(warning => <p role="alert" key={warning}>{warning}</p>)}
    <p className="da-dim">年度资料随插件更新。未收录年份不预测调休；手工修改的年度资料继续保留。</p>
  </section>
}

export function AgendaSettingsCard({ client, view }: { client: AgendaClient, view?: string }): React.ReactElement {
  if (view === 'summary') return <span>周起始日与离线节假日资料</span>
  return <AgendaProvider client={client}><SettingsContent /></AgendaProvider>
}
