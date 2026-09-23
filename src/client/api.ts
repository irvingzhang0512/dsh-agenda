/**
 * dsh-agenda — 浏览器端 WS 客户端与状态钩子。
 *
 * - 自动重连（指数退避 + 上限），断线期间操作排队等待重连后执行；
 * - 全量快照（events/todos/categories/settings/dataVersion）单源状态；
 * - 月历信息缓存（农历/节假日/周末的 DayInfo），快照版本变化时失效；
 * - 所有变更都走 op 往返：请求 id 关联结果，成功后由广播快照驱动刷新。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgendaEvent, AgendaSnapshot, AgendaTodo, ClientOp, DayInfo, EventInput, EventPatch, TodoInput, TodoInstance, TodoPatch } from '../shared/types.ts'
import type { HostMessage } from '../shared/types.ts'

const BRIDGE_PATH = '/agenda/ws'
const RECONNECT_BASE_MS = 800
const RECONNECT_MAX_MS = 10_000

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

/** AgendaClient：WS 连接 + 快照状态 + op 往返。 */
export class AgendaClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, Pending>()
  private listeners = new Set<() => void>()
  private reconnectTimer: number | undefined
  private failures = 0
  private manualClose = false
  private opQueue: Array<{ id: string, op: ClientOp, args: Record<string, unknown> }> = []

  connected = false
  snapshot: AgendaSnapshot | null = null
  error: string | null = null
  /** 月历信息缓存：key `YYYY-MM`。 */
  private calendarCache = new Map<string, DayInfo[]>()

  constructor(private readonly wsUrl: string) {
    this.connect()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private connect(): void {
    if (this.manualClose) return
    const ws = new WebSocket(this.wsUrl)
    this.ws = ws
    ws.onopen = () => {
      this.connected = true
      this.failures = 0
      this.notify()
      // 重连后补发积压的操作
      const backlog = this.opQueue.splice(0)
      for (const queued of backlog) this.sendOp(queued.op, queued.args, queued.id)
      void this.requestSnapshot()
    }
    ws.onmessage = event => {
      let message: HostMessage
      try {
        message = JSON.parse(String(event.data)) as HostMessage
      } catch {
        return
      }
      if (message.type === 'snapshot') {
        this.snapshot = message.snapshot
        this.calendarCache.clear()
        this.error = null
        this.notify()
      } else if (message.type === 'op-result') {
        const p = this.pending.get(message.id)
        if (p === undefined) return
        this.pending.delete(message.id)
        if (message.ok) p.resolve(message.result)
        else p.reject(new Error(message.message))
      } else if (message.type === 'error') {
        this.error = message.message
        this.notify()
      }
    }
    ws.onclose = () => {
      const wasConnected = this.connected
      this.connected = false
      if (this.ws === ws) this.ws = null
      // 未决操作改为失败（重连后由 UI 重试或广播快照自动纠正）
      if (this.pending.size > 0) {
        const lost = [...this.pending.entries()]
        this.pending.clear()
        for (const [, p] of lost) p.reject(new Error('连接已断开，请重试。'))
      }
      if (wasConnected) this.notify()
      if (!this.manualClose) {
        this.failures += 1
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.failures)
        this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
      }
    }
    ws.onerror = () => ws.close()
  }

  private requestSnapshot(): void {
    void this.op<AgendaSnapshot>('get-snapshot', {}).then(snapshot => {
      this.snapshot = snapshot
      this.notify()
    }).catch(() => undefined)
  }

  /** 发送 op；断线时排队（等待重连），超时未应答则拒绝。 */
  op<T>(op: ClientOp, args: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    const id = `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error('操作超时，请重试。'))
        }
      }, timeoutMs)
      const settle = (value: unknown, error?: Error): void => {
        window.clearTimeout(timer)
        if (error !== undefined) reject(error)
        else resolve(value as T)
      }
      this.pending.set(id, { resolve: value => settle(value), reject: error => settle(undefined, error) })
      this.sendOp(op, args, id)
    })
  }

  private sendOp(op: ClientOp, args: Record<string, unknown>, id?: string): void {
    const opId = id ?? `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
      this.opQueue.push({ id: opId, op, args })
      return
    }
    this.ws.send(JSON.stringify({ type: 'op', id: opId, op, args }))
  }

  // ── 便捷操作（供视图调用）─────────────────────────────────────────────

  createEvent(input: EventInput): Promise<AgendaEvent> {
    return this.op<AgendaEvent>('create-event', { input })
  }
  updateEvent(id: string, patch: EventPatch): Promise<AgendaEvent> {
    return this.op<AgendaEvent>('update-event', { id, patch })
  }
  deleteEvent(id: string): Promise<{ deleted_id: string }> {
    return this.op('delete-event', { id })
  }
  createTodo(input: TodoInput): Promise<AgendaTodo> {
    return this.op<AgendaTodo>('create-todo', { input })
  }
  updateTodo(id: string, patch: TodoPatch): Promise<AgendaTodo> {
    return this.op<AgendaTodo>('update-todo', { id, patch })
  }
  deleteTodo(id: string): Promise<{ deleted_id: string }> {
    return this.op('delete-todo', { id })
  }
  /** 待办实例列表（重复待办按日期展开；range/status 可选）。 */
  listTodoInstances(range?: { from: string, to: string }, status?: 'pending' | 'completed'): Promise<TodoInstance[]> {
    return this.op<TodoInstance[]>('todo-instances', {
      ...(range !== undefined ? { from: range.from, to: range.to } : {}),
      ...(status !== undefined ? { status } : {}),
    })
  }
  /** 完成重复待办的指定日期实例（date 缺省 = 完成下一次）。 */
  completeTodoInstance(id: string, date?: string): Promise<AgendaTodo> {
    return this.updateTodo(id, { status: 'completed', statusDate: date })
  }
  createCategory(path: string): Promise<string[]> {
    return this.op<string[]>('create-category', { path })
  }
  deleteCategory(path: string): Promise<string[]> {
    return this.op<string[]>('delete-category', { path })
  }

  /** 某月的 DayInfo（带缓存）。 */
  async monthInfo(year: number, month: number): Promise<DayInfo[]> {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const cached = this.calendarCache.get(key)
    if (cached !== undefined) return cached
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const days = await this.op<DayInfo[]>('calendar-info', { from, to })
    this.calendarCache.set(key, days)
    return days
  }

  /** 指定日期区间的 DayInfo（尽量用缓存拼接）。 */
  async rangeInfo(from: string, to: string): Promise<DayInfo[]> {
    const byDate = new Map<string, DayInfo>()
    let cursor = from
    let guard = 0
    while (cursor <= to && guard < 61) {
      const year = Number(cursor.slice(0, 4))
      const month = Number(cursor.slice(5, 7))
      const monthDays = await this.monthInfo(year, month)
      for (const day of monthDays) byDate.set(day.date, day)
      cursor = this.shiftMonth(cursor)
      guard += 1
    }
    const result: DayInfo[] = []
    let current = from
    while (current <= to) {
      const info = byDate.get(current)
      if (info === undefined) break
      result.push(info)
      current = this.shiftDay(current)
    }
    if (result.length > 0) return result
    return this.op<DayInfo[]>('calendar-info', { from, to })
  }

  private shiftDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  private shiftMonth(date: string): string {
    const y = Number(date.slice(0, 4))
    const m = Number(date.slice(5, 7))
    const next = m === 12 ? 1 : m + 1
    const nextYear = m === 12 ? y + 1 : y
    return `${nextYear}-${String(next).padStart(2, '0')}-01`
  }

  dispose(): void {
    this.manualClose = true
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.pending.clear()
    this.listeners.clear()
  }
}

/** React 状态钩子：订阅 AgendaClient 的快照 / 连接状态。 */
export function useAgendaState(client: AgendaClient | null): { connected: boolean, snapshot: AgendaSnapshot | null, error: string | null } {
  const [state, setState] = useState<{ connected: boolean, snapshot: AgendaSnapshot | null, error: string | null }>({
    connected: client?.connected ?? false,
    snapshot: client?.snapshot ?? null,
    error: client?.error ?? null,
  })
  useEffect(() => {
    if (client === null) return
    const sync = (): void => {
      setState({ connected: client.connected, snapshot: client.snapshot, error: client.error })
    }
    sync()
    return client.subscribe(sync)
  }, [client])
  return state
}

/** 建立单例客户端（模块级，保证多视图共享同一连接）。 */
let sharedClient: AgendaClient | null = null

export function getAgendaClient(): AgendaClient {
  if (sharedClient === null) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    sharedClient = new AgendaClient(`${protocol}//${window.location.host}${BRIDGE_PATH}`)
  }
  return sharedClient
}

export function disposeAgendaClient(): void {
  sharedClient?.dispose()
  sharedClient = null
}

export function useMemoClient(): AgendaClient {
  return useMemo(() => getAgendaClient(), [])
}
