/**
 * dsh-agenda — WS 线协议：消息解析与结构化结果信封。
 *
 * 客户端 → 宿主：hello / op（operation 名 + 参数 + 请求 id）
 * 宿主 → 客户端：snapshot（全量）/ op-result（id 关联）/ error
 */
import type { ClientMessage, ClientOp, HostMessage } from '../shared/types.ts'

/** 解析客户端消息；非法消息返回 null（丢弃即可）。 */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value !== 'object' || value === null) return null
    const message = value as Record<string, unknown>
    if (message.type === 'hello') return { type: 'hello' }
    if (message.type === 'op') {
      if (typeof message.id !== 'string' || typeof message.op !== 'string') return null
      const args = (message.args ?? {}) as Record<string, unknown>
      return { type: 'op', id: message.id, op: message.op as ClientOp, args }
    }
    return null
  } catch {
    return null
  }
}

/** 序列化宿主消息（JSON 单行）。 */
export function stringifyHostMessage(message: HostMessage): string {
  return JSON.stringify(message)
}
