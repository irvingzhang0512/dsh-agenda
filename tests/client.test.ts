import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AgendaClient } from '../src/client/api.ts'
import { agendaSocketUrl } from '../src/client/native.ts'
import type { AgendaSnapshot } from '../src/shared/types.ts'

class Socket {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 0
  onopen?: () => void
  onclose?: () => void
  onerror?: () => void
  onmessage?: (event: {data: string}) => void
  frames: any[] = []
  constructor(readonly url: string) { Socket.instances.push(this) }
  send(raw: string) { this.frames.push(JSON.parse(raw)) }
  open() { this.readyState = 1; this.onopen?.() }
  close() { this.readyState = 3; this.onclose?.() }
  message(data: unknown) { this.onmessage?.({data: JSON.stringify(data)}) }
}
const snapshot = (version = 0): AgendaSnapshot => ({ dataVersion: version, events: [], todos: [], categories: [], settings: {weekStart:'monday'}, settingsRevision:'r', holidayData:{packageVersion:'1.5.9', supportedYears:[2026], localOverrideYears:[], legacyFullYears:[], warnings:[]} })
let clients: AgendaClient[] = []
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal('window', globalThis); vi.stubGlobal('WebSocket', Socket) })
afterEach(() => { for (const client of clients) client.dispose(); clients=[]; vi.useRealTimers(); vi.unstubAllGlobals() })
function start() {
  const client = new AgendaClient('ws://localhost/agenda/ws'); clients.push(client)
  const socket = Socket.instances.at(-1)!
  socket.open(); socket.message({type:'snapshot',snapshot:snapshot()})
  const request = socket.frames.find(frame => frame.op === 'get-snapshot')
  socket.message({type:'op-result',id:request.id,ok:true,result:snapshot()})
  return {client,socket}
}

test('原生地址来自公开 transport，HTTP 保留完整端口', () => {
  expect(agendaSocketUrl({protocol:'dsh-app:',href:'dsh-app://app/'},{streamBaseUrl:'http://127.0.0.1:1234/'})).toBe('ws://127.0.0.1:1234/agenda/ws')
  expect(agendaSocketUrl({protocol:'https:',href:'https://localhost:4567/'})).toBe('wss://localhost:4567/agenda/ws')
  expect(() => agendaSocketUrl({protocol:'dsh-app:',href:'dsh-app://app/'})).toThrow()
  expect(() => agendaSocketUrl({protocol:'dsh-app:',href:'dsh-app://app/'},{streamBaseUrl:'https://example.com/'})).toThrow()
})
test('断线和尚无快照时拒绝写入，未产生操作帧', async () => {
  const client = new AgendaClient('ws://localhost'); clients.push(client)
  await expect(client.createCategory('x')).rejects.toThrow('未发送')
  Socket.instances[0]!.open()
  await expect(client.createCategory('x')).rejects.toThrow('未发送')
  expect(Socket.instances[0]!.frames.filter(frame => frame.op === 'create-category')).toHaveLength(0)
})
test('已发送写入断线结果未知，重连建立新基线，不重放；旧连接失效', async () => {
  const {client,socket} = start(); await Promise.resolve()
  socket.message({type:'snapshot',snapshot:snapshot(12)})
  const operation = client.createCategory('x')
  const rejected = expect(operation).rejects.toThrow('结果未确认')
  socket.close(); await rejected
  await vi.advanceTimersByTimeAsync(1600)
  const fresh = Socket.instances.at(-1)!; fresh.open()
  fresh.message({type:'snapshot',snapshot:snapshot(0)})
  socket.message({type:'snapshot',snapshot:snapshot(99)})
  expect(client.snapshot?.dataVersion).toBe(0)
  expect(client.error).toContain('结果未确认')
  expect(fresh.frames.filter(frame => frame.op === 'create-category')).toHaveLength(0)
  const refresh = client.refresh(), request = fresh.frames.at(-1)!
  fresh.message({type:'op-result',id:request.id,ok:true,result:snapshot(0)})
  await refresh
  expect(client.error).toBe(null)
})
test('超时写入不重放，晚到结果无效；卸载释放所有请求和定时器', async () => {
  const {client,socket} = start(); await Promise.resolve()
  const operation = client.op('create-category',{path:'x'},50)
  const rejected = expect(operation).rejects.toThrow('结果未确认')
  await vi.advanceTimersByTimeAsync(50); await rejected
  const frame = socket.frames.at(-1)!
  socket.message({type:'op-result',id:frame.id,ok:true,result:[]})
  expect(socket.frames.filter(frame => frame.op === 'create-category')).toHaveLength(1)
  const pending = client.op('get-snapshot')
  const disposed = expect(pending).rejects.toThrow('卸载')
  client.dispose(); await disposed
  expect(client.connected).toBe(false); expect(vi.getTimerCount()).toBe(0)
})
test('新快照失效月缓存，查询期间变更不会污染缓存', async () => {
  const {client,socket} = start(); await Promise.resolve()
  const query = client.monthInfo(2026,1), frame = socket.frames.at(-1)!
  socket.message({type:'snapshot',snapshot:snapshot(1)})
  socket.message({type:'op-result',id:frame.id,ok:true,result:[]})
  await query
  const next = client.monthInfo(2026,1), second = socket.frames.at(-1)!
  expect(second.id).not.toBe(frame.id)
  socket.message({type:'op-result',id:second.id,ok:true,result:[]}); await next
})
