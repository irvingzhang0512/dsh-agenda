/**
 * dsh-agenda — 宿主半（Node）。
 *
 * 装配：
 * - 数据目录解析（<DSH_DATA_DIR>/agenda，不写死用户路径）+ 目录初始化；
 * - CsvAgendaStorage（文件锁 / 原子写 / 自动备份）+ AgendaService；
 * - 13 个 agenda_* 工具；
 * - 捆绑 agenda skill 自注册（ctx.skills）；
 * - `/agenda/ws` WebSocket 桥（浏览器 UI ↔ 同一套 Service）；
 * - 离线节假日库与只读本地覆盖合并，并监听年度资料变化。
 *
 * 数据流（需求 §18）：UI / Voice / Text → Bridge|DSH Agent → AgendaService
 * → AgendaStorage → 本地文件；所有入口共用同一份业务层。
 */
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { watch } from 'node:fs'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { createHolidaySource } from './host/holiday-source.ts'
import type { Duplex } from 'node:stream'
import { AgendaService } from './core/agenda.ts'
import { AgendaError } from './core/errors.ts'
import { resolveDataDir } from './storage/file-lock.ts'
import { CsvAgendaStorage } from './storage/csv-storage.ts'
import { registerAgendaTools } from './host/tools.ts'
import { AgendaBridge } from './host/bridge.ts'
import { loadBundledSkill } from './host/skill-registration.ts'
import { isTrustedAgendaRequest } from './host/trust-fence.ts'
import { parseClientMessage, stringifyHostMessage } from './shared/wire.ts'
import type { ClientOp } from './shared/types.ts'
import type { Context } from './context-types.ts'

/** 插件身份（cordis.yml 行 / client-modules 注册名）。 */
export const name = 'dsh-agenda'

/** 必需服务：工具注册、WebSocket 升级面。Skill 条件注册。 */
export const inject = ['tools', 'webServer']
export const Config = z.object({})

/** 桥路径（与 client 半保持一致）。 */
export const BRIDGE_PATH = '/agenda/ws'

/** 插件主体；先完成目录与离线资料初始化，再公开服务。 */
export async function apply(ctx: Context): Promise<void> {
  const storage = new CsvAgendaStorage(resolveDataDir())
  await storage.ensureLayout()
  const service = new AgendaService(storage, { holidaySource: createHolidaySource() })
  await service.holidays.summary()
  const bridge = new AgendaBridge()
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1_048_576 })
  let closed = false
  let publishTail: Promise<void> = Promise.resolve()
  const publish = (): void => {
    publishTail = publishTail.catch(() => undefined).then(async () => {
      if (!closed) { const snapshot = await service.snapshot(); if (!closed) bridge.broadcastSnapshot(snapshot) }
    }).catch(error => { ctx.logger?.warn?.(`[dsh-agenda] 快照刷新失败: ${String(error)}`) })
  }
  ctx.effect(() => ctx.provide('agenda', {
    id: 'dsh-agenda' as const,
    getSnapshot: () => service.snapshot(),
    getDataDir: () => storage.dataDir,
  }), 'dsh-agenda: service')
  ctx.effect(() => service.subscribe(publish), 'dsh-agenda: changes')
  ctx.effect(() => registerAgendaTools(ctx, { service }), 'dsh-agenda: tools')
  ctx.inject(['skills'], sctx => sctx.effect(() => {
    let disposed = false, remove: (() => void) | undefined
    void loadBundledSkill().then(skill => { if (!disposed && skill) remove = sctx.skills.register(skill) }).catch(error => ctx.logger?.warn?.(String(error)))
    return () => { disposed = true; remove?.() }
  }, 'dsh-agenda: skill'))
  ctx.effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const watcher = watch(join(storage.dataDir, 'holidays'), () => {
      if (closed) return
      clearTimeout(timer)
      timer = setTimeout(() => { if (!closed) void service.refreshHolidays().catch(error => ctx.logger?.warn?.(String(error))) }, 100)
      timer.unref()
    })
    watcher.on('error', error => ctx.logger?.warn?.(`[dsh-agenda] 本地资料监听失败: ${error.message}`))
    return () => { clearTimeout(timer); watcher.close() }
  }, 'dsh-agenda: holiday files')
  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: BRIDGE_PATH,
    handler: (req, socket, head) => {
      const incoming = req as IncomingMessage
      if (closed || !isTrustedAgendaRequest(incoming)) { (socket as unknown as Duplex).destroy(); return }
      wss.handleUpgrade(incoming, socket as unknown as Duplex, head as Buffer, ws => attach(ws))
    },
  }), 'dsh-agenda: ws route')

  /** 挂接一个连接：hello 后立即推送快照；op 按名分发。 */
  function attach(ws: WebSocket): void {
    const detach = bridge.attach(ws)
    ws.on('message', data => {
      let raw = ''
      try {
        raw = data.toString()
      } catch {
        return
      }
      const message = parseClientMessage(raw)
      if (message === null) return
      if (message.type === 'hello') {
        void service.snapshot().then(snapshot => bridge.send(ws, { type: 'snapshot', snapshot })).catch(() => undefined)
        return
      }
      const { id, op, args } = message
      void dispatch(op, args ?? {}).then(result => {
        bridge.send(ws, { type: 'op-result', id, ok: true, message: '操作成功。', result })

      }, (error: unknown) => {
        bridge.send(ws, {
          type: 'op-result',
          id,
          ok: false,
          message: error instanceof AgendaError ? error.message : error instanceof Error ? error.message : String(error),
          result: error instanceof AgendaError ? { code: error.code } : { code: 'INTERNAL_ERROR' },
        })
      })
    })
    ws.on('close', detach)
  }

  /** op 分发：全部落到 AgendaService（与 Agent 工具同一套业务层）。 */
  async function dispatch(op: ClientOp, args: Record<string, unknown>): Promise<unknown> {
    switch (op) {
      case 'update-settings': return service.updateSettings(args.patch as Parameters<AgendaService['updateSettings']>[0], String(args.expectedRevision ?? ''))
      case 'get-snapshot': return service.snapshot()
      case 'calendar-info': {
        const from = String(args.from ?? '')
        const to = String(args.to ?? '')
        return service.calendarInfo(from, to)
      }
      case 'create-event': return service.createEvent(args.input as Parameters<AgendaService['createEvent']>[0])
      case 'update-event': return service.updateEvent(String(args.id), args.patch as Parameters<AgendaService['updateEvent']>[1])
      case 'delete-event': return service.deleteEvent(String(args.id))
      case 'create-todo': return service.createTodo(args.input as Parameters<AgendaService['createTodo']>[0])
      case 'update-todo': return service.updateTodo(String(args.id), args.patch as Parameters<AgendaService['updateTodo']>[1])
      case 'delete-todo': return service.deleteTodo(String(args.id))
      case 'todo-instances': return service.listTodoInstances(
        args.from !== undefined && args.to !== undefined ? { from: String(args.from), to: String(args.to) } : undefined,
        args.status === 'pending' ? 'pending' : args.status === 'completed' ? 'completed' : undefined,
      )
      case 'create-category': return service.createCategory(String(args.path))
      case 'delete-category': return service.deleteCategory(String(args.path))
      case 'statistics': return service.statistics({ from: String(args.from), to: String(args.to) })
      case 'search': return service.search(String(args.query), {
        eventsRange: args.eventsFrom !== undefined && args.eventsTo !== undefined ? { from: String(args.eventsFrom), to: String(args.eventsTo) } : undefined,
        todosRange: args.todosFrom !== undefined && args.todosTo !== undefined ? { from: String(args.todosFrom), to: String(args.todosTo) } : undefined,
      })
      default: {
        throw new AgendaError('INVALID_ARGUMENT', `不支持的操作: ${String(op)}`)
      }
    }
  }

  ctx.effect(() => async () => {
    closed = true
    bridge.close()
    for (const socket of wss.clients) socket.terminate()
    wss.close()
    await publishTail
    await service.snapshot()
  }, 'dsh-agenda: shutdown')
}

// 调试用线协议序列化入口。
export { stringifyHostMessage }
