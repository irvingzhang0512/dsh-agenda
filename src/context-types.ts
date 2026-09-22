/**
 * dsh-agenda — host 半结构服务面。
 *
 * 以「结构镜像 + 交集」组合 cordis Context（同 dsh-better-sidebar-controller
 * 的做法）：DSH 自带包已 augment 过 cordis Context，这里只重述本插件触碰的
 * 成员，避免 interface 合并冲突（TS2717）。
 *
 * 本文件必须保持无浏览器类型：tools / index 均引用它。
 */
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

/** upgrade socket 的破坏面（信任栅栏只用 destroy）。 */
export interface UpgradeSocket {
  destroy(): void
}

export type UpgradeHead = Uint8Array

/** 一条精确路径的 HTTP upgrade 注册（WebUpgradeRoute 的结构镜像）。 */
export interface UpgradeRoute {
  path: string
  handler: (req: unknown, socket: UpgradeSocket, head: UpgradeHead) => void | Promise<void>
}

/** webServer 服务面（本插件只用 upgrade）。 */
export interface WebServer {
  registerUpgrade(route: UpgradeRoute): () => void
}

/** webRuntime 服务面（信任主机清单）。 */
export interface WebRuntime {
  trustedHosts: readonly string[]
}

/** tools 服务面（dsh-tools 已 augment Context；此处供无 augment 的调用点）。 */
export interface Tools {
  register(tool: ToolDefinition): () => void
}

/** skills 服务面（可选：旧运行时无注册表时跳过 skill 自注册）。 */
export interface Skills {
  register(skill: SkillRegistration): () => void
}

/** 本插件 host 半看到的 Context。 */
export interface AgendaContextShape {
  webServer: WebServer
  webRuntime: WebRuntime
  tools: Tools
  skills?: Skills
}

export type Context = CordisContext & AgendaContextShape
