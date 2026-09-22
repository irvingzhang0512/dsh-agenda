/**
 * dsh-agenda — 宿主半（Node）。
 *
 * 装配：
 * - 数据目录解析（<DSH_DATA_DIR>/agenda，不写死用户路径）+ 目录初始化；
 * - CsvAgendaStorage（文件锁 / 原子写 / 自动备份）+ AgendaService；
 * - 13 个 agenda_* 工具；
 * - 捆绑 agenda skill 自注册（ctx.skills）；
 * - `/agenda/ws` WebSocket 桥（浏览器 UI ↔ 同一套 Service）；
 * - 首次挂载时把捆绑的官方节假日数据 seed 到数据目录。
 *
 * 数据流（需求 §18）：UI / Voice / Text → Bridge|DSH Agent → AgendaService
 * → AgendaStorage → 本地文件；所有入口共用同一份业务层。
 */
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { AgendaService } from './core/agenda.ts'
import { AgendaError } from './core/errors.ts'
import { resolveDataDir } from './storage/file-lock.ts'
import { CsvAgendaStorage } from './storage/csv-storage.ts'
import { registerAgendaTools } from './host/tools.ts'
import { AgendaBridge } from './host/bridge.ts'
import { seedBundledHolidays } from './host/seed.ts'
import { loadBundledSkill } from './host/skill-registration.ts'
import { isTrustedAgendaRequest } from './host/trust-fence.ts'
import { parseClientMessage, stringifyHostMessage } from './shared/wire.ts'
import type { ClientOp } from './shared/types.ts'
import type { Context } from './context-types.ts'

/** 插件身份（cordis.yml 行 / client-modules 注册名）。 */
export const name = 'dsh-agenda'

/** 需要的服务：工具注册、Skill 注册、WebSocket 升级面、web 运行时信任主机。 */
export const inject = ['tools', 'skills', 'webServer', 'webRuntime']

/** 桥路径（与 client 半保持一致）。 */
export const BRIDGE_PATH = '/agenda/ws'

/** 捆绑节假日目录（src/ 与 lib/ 深度一致，一个 URL 两端通用）。 */
const HOLIDAYS_URL = new URL('../../holidays/', import.meta.url)

/** 插件主体。 */
export function apply(ctx: Context): void {
  const dataDir = resolveDataDir()
  const storage = new CsvAgendaStorage(dataDir)
  const service = new AgendaService(storage)
  const bridge = new AgendaBridge()

  // 一次性目录初始化 + 节假日 seed（幂等；失败仅记日志不阻断）
  void (async () => {
    try {
      await storage.ensureLayout()
      const seeded = await seedBundledHolidays(storage, HOLIDAYS_URL)
      if (seeded > 0) {
        ctx.logger?.info?.(`[dsh-agenda] 已 seed ${seeded} 年节假日数据到 ${storage.dataDir}`)
      }
    } catch (error) {
      ctx.logger?.warn?.(`[dsh-agenda] 初始化数据目录失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  })()

  // 宿主服务面（供未来插件集成；与 inventory 集成关系独立记录）
  const removeService = ctx.provide('agenda', {
    id: 'dsh-agenda' as const,
    getSnapshot: () => service.snapshot(),
    getDataDir: () => storage.dataDir,
  })

  // 13 个工具
  const toolsDisposer = registerAgendaTools(ctx, { service })

  // 捆绑 skill 自注册（异步读文件，teardown 竞态安全）
  ctx.effect(() => {
    const skills = ctx.skills
    let disposed = false
    let skillDisposer: (() => void) | undefined
    if (skills?.register !== undefined) {
      void loadBundledSkill().then(skill => {
        if (disposed || skill === undefined) return
        skillDisposer = skills.register(skill)
      })
    }
    return () => {
      disposed = true
      skillDisposer?.()
    }
  }, 'dsh-agenda: bundled skill')

  // ── WS 桥 ───────────────────────────────────────────────────────────────
  const wss = new WebSocketServer({ noServer: true })
  const removeUpgrade = ctx.webServer.registerUpgrade({
    path: BRIDGE_PATH,
    handler: (req, socket, head) => {
      const incoming = req as IncomingMessage
      if (!isTrustedAgendaRequest(incoming, ctx.webRuntime.trustedHosts)) {
        (socket as unknown as Duplex).destroy()
        return
      }
      wss.handleUpgrade(incoming, socket as unknown as Duplex, head as Buffer, ws => attach(ws))
    },
  })

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
        // 变更类操作向所有观察者广播最新快照
        if (isMutating(op)) {
          void service.snapshot().then(snapshot => bridge.broadcastSnapshot(snapshot)).catch(() => undefined)
        }
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

  /** 是否变更类操作（需要广播快照）。 */
  function isMutating(op: ClientOp): boolean {
    return op === 'create-event' || op === 'update-event' || op === 'delete-event'
      || op === 'create-todo' || op === 'update-todo' || op === 'delete-todo'
      || op === 'create-category' || op === 'delete-category'
  }

  ctx.effect(() => () => {
    removeService()
    toolsDisposer()
    removeUpgrade()
    bridge.close()
    wss.close()
  }, 'dsh-agenda: teardown')
}

// 供外部调试 / 测试读取的线协议序列化入口
export { stringifyHostMessage }
