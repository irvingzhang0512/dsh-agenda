/** 原生／HTTP 共用 WS 客户端；只读重连，不重放写操作。 */
import { useEffect, useMemo, useState } from 'react'
import type { AgendaEvent, AgendaSnapshot, AgendaTodo, ClientOp, DayInfo, EventInput, EventPatch, TodoInput, TodoInstance, TodoPatch, AgendaSettings, HostMessage } from '../shared/types.ts'
import { agendaSocketUrl } from './native.ts'

interface Pending { resolve: (value: unknown) => void, reject: (error: Error) => void, timer: number, mutating: boolean }
const mutationOps = new Set<ClientOp>(['create-event','update-event','delete-event','create-todo','update-todo','delete-todo','create-category','delete-category','update-settings'])
export class AgendaClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, Pending>()
  private listeners = new Set<() => void>()
  private reconnectTimer: number | undefined
  private failures = 0
  private manualClose = false
  private baselineReady = false
  private generation = 0
  private calendarCache = new Map<string, DayInfo[]>()
  readonly uiState = new Map<string, unknown>()
  connected = false
  snapshot: AgendaSnapshot | null = null
  error: string | null = null
  private operationError: string | null = null

  constructor(private readonly wsUrl: string | null, unavailable?: string) {
    this.error = unavailable ?? null
    if (wsUrl) this.connect()
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private notify(): void { for (const listener of this.listeners) listener() }

  private acceptSnapshot(snapshot: AgendaSnapshot): void {
    if (!snapshot || !Number.isSafeInteger(snapshot.dataVersion) || !Array.isArray(snapshot.events) || !Array.isArray(snapshot.todos) || !snapshot.settings || !snapshot.holidayData) return
    if (this.baselineReady && this.snapshot && snapshot.dataVersion < this.snapshot.dataVersion) return
    this.baselineReady = true; this.connected = true
    this.snapshot = snapshot; this.calendarCache.clear(); this.error = this.operationError; this.notify()
  }
  private connect(): void {
    if (this.manualClose || !this.wsUrl) return
    this.baselineReady = false; this.generation += 1
    const generation = this.generation
    const ws = new WebSocket(this.wsUrl); this.ws = ws
    ws.onopen = () => {
      if (this.ws !== ws || this.manualClose) return
      this.failures = 0
      ws.send(JSON.stringify({ type: 'hello' }))
      void this.refresh(false).catch(error => { if (this.ws === ws) { this.error = String(error.message); this.notify() } })
    }
    ws.onmessage = event => {
      if (this.ws !== ws || this.manualClose) return
      let message: HostMessage
      try { message = JSON.parse(String(event.data)) } catch { return }
      if (!message || typeof message !== 'object') return
      if (message.type === 'snapshot') this.acceptSnapshot(message.snapshot)
      else if (message.type === 'op-result') {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id); window.clearTimeout(pending.timer)
        if (message.ok) pending.resolve(message.result)
        else pending.reject(Object.assign(new Error(message.message), { code: (message.result as { code?: string })?.code }))
      } else if (message.type === 'error') { this.error = message.message; this.notify() }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null; this.connected = false; this.baselineReady = false; this.calendarCache.clear()
      for (const p of this.pending.values()) { window.clearTimeout(p.timer); p.reject(new Error(p.mutating ? '连接断开，操作结果未确认，请刷新核对。' : '连接已断开，请重试。')) }
      this.pending.clear(); this.notify()
      if (!this.manualClose && generation === this.generation) {
        this.failures += 1
        this.reconnectTimer = window.setTimeout(() => this.connect(), Math.min(10_000, 800 * 2 ** this.failures))
      }
    }
    ws.onerror = () => { if (this.ws === ws) ws.close() }
  }
  async refresh(clearWarning = true): Promise<void> {
    const generation = this.generation
    const snapshot = await this.op<AgendaSnapshot>('get-snapshot')
    if (generation === this.generation && !this.manualClose) { if (clearWarning) this.operationError = null; this.acceptSnapshot(snapshot) }
  }
  op<T>(op: ClientOp, args: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    const mutating = mutationOps.has(op)
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || (mutating && !this.baselineReady)) return Promise.reject(new Error('日程服务尚未连接，操作未发送。'))
    const id = 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2)
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(mutating ? '操作超时，结果未确认，请刷新核对。' : '查询超时，请重试。'))
      }, timeoutMs)
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer, mutating })
      try { this.ws!.send(JSON.stringify({ type: 'op', id, op, args })) } catch {
        window.clearTimeout(timer); this.pending.delete(id); reject(new Error(mutating ? '发送失败，结果未确认，请刷新核对。' : '发送失败，请重试。'))
      }
    }).catch(error => { if (mutating) this.operationError = error.message; this.error = error.message; this.notify(); throw error })
  }
  async updateSettings(patch: Partial<AgendaSettings>, expectedRevision: string): Promise<AgendaSnapshot> {
    const snapshot = await this.op<AgendaSnapshot>('update-settings', { patch, expectedRevision })
    this.acceptSnapshot(snapshot)
    return snapshot
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
    const generation = this.generation, version = this.snapshot?.dataVersion
    const days = await this.op<DayInfo[]>('calendar-info', { from, to })
    if (generation === this.generation && version === this.snapshot?.dataVersion) this.calendarCache.set(key, days)
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
    this.manualClose = true; this.generation += 1
    window.clearTimeout(this.reconnectTimer)
    const socket = this.ws; this.ws = null; socket?.close()
    for (const p of this.pending.values()) { window.clearTimeout(p.timer); p.reject(new Error(p.mutating ? '日程插件已卸载，操作结果未确认。' : '日程插件已卸载。')) }
    this.pending.clear(); this.connected = false; this.notify()
    this.listeners.clear(); this.uiState.clear(); this.calendarCache.clear()
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


let sharedClient: AgendaClient | null = null
export function getAgendaClient(): AgendaClient {
  if (!sharedClient) {
    try { sharedClient = new AgendaClient(agendaSocketUrl(window.location, (globalThis as { __DSH_TRANSPORT__?: { streamBaseUrl?: string } }).__DSH_TRANSPORT__)) }
    catch (error) { sharedClient = new AgendaClient(null, (error as Error).message) }
  }
  return sharedClient
}
export function disposeAgendaClient(): void { sharedClient?.dispose(); sharedClient = null }
export function useMemoClient(): AgendaClient { return useMemo(() => getAgendaClient(), []) }
