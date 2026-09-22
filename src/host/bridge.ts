/**
 * dsh-agenda — AgendaBridge：浏览器 UI 与宿主服务的 WS 通道。
 *
 * Agenda 是用户级全局数据（不绑定会话），因此桥不区分 sessionId；
 * 一个连接即一个观察者。任何变更（UI / Agent 工具）都会向所有连接广播
 * 全量快照，保证「UI、Agent、Tool 看到同一份数据」。
 */
import WebSocket from 'ws'
import type { AgendaSnapshot, HostMessage } from '../shared/types.ts'

export class AgendaBridge {
  private readonly sockets = new Set<WebSocket>()

  /** 挂接一个连接；返回 detach。 */
  attach(ws: WebSocket): () => void {
    this.sockets.add(ws)
    ws.on('close', () => this.sockets.delete(ws))
    ws.on('error', () => this.sockets.delete(ws))
    return () => {
      this.sockets.delete(ws)
    }
  }

  /** 向单个连接发送消息。 */
  send(ws: WebSocket, message: HostMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }

  /** 向全部连接广播消息。 */
  broadcast(message: HostMessage): void {
    const body = JSON.stringify(message)
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(body)
    }
  }

  /** 广播全量快照。 */
  broadcastSnapshot(snapshot: AgendaSnapshot): void {
    this.broadcast({ type: 'snapshot', snapshot })
  }

  close(): void {
    for (const ws of this.sockets) ws.close()
    this.sockets.clear()
  }
}
