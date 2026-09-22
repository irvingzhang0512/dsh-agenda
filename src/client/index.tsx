/**
 * dsh-agenda — client 半入口（浏览器）。
 *
 * 注册：
 * - main 面板（key 'agenda'）：AgendaApp 主界面；
 * - sidebar.panellist（id 'agenda'）：侧栏图标。
 * 连接 WS 桥并与宿主共享同一套 AgendaService。
 */
import type { ReactElement } from 'react'
import { AgendaApp } from './agenda-app.tsx'
import { disposeAgendaClient, getAgendaClient } from './api.ts'
import { injectStyle } from './style.ts'

/** client 侧需要的服务。 */
export const inject = ['slots']

/** 侧栏图标（Calendar 线框）。 */
function AgendaGlyph({ size = 18, active }: { size?: number, active?: boolean }): ReactElement {
  const stroke = active ? '#2f6fed' : 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-label="Agenda">
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4M16 2.5v4" />
      <path d="M7.5 13.5h3M13.5 13.5h3M7.5 17h3M13.5 17h3" />
    </svg>
  )
}

/** client 入口。 */
export function apply(ctx: {
  slots: {
    inject(name: string, register: () => () => void): void
    register(options: { name: string, key?: string, id?: string, order?: number, label?: () => string }, component: (props: never) => ReactElement | null): () => void
  }
  effect(fn: () => () => void, label?: string): void
}): void {
  injectStyle()

  const client = getAgendaClient()

  // 主面板（keyed 插槽 main）
  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: 'agenda', order: 50 },
    () => <AgendaApp client={client} />,
  ))

  // 侧栏条目
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: 'agenda', order: 60, label: () => 'Agenda' },
    (props: { size: number, active: boolean }) => <AgendaGlyph size={props.size} active={props.active} />,
  ))

  // 卸载时释放 WS 连接
  ctx.effect(() => () => {
    disposeAgendaClient()
  }, 'dsh-agenda: client dispose')
}
