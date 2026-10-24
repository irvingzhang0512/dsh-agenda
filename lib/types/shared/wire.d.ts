/**
 * dsh-agenda — WS 线协议：消息解析与结构化结果信封。
 *
 * 客户端 → 宿主：hello / op（operation 名 + 参数 + 请求 id）
 * 宿主 → 客户端：snapshot（全量）/ op-result（id 关联）/ error
 */
import type { ClientMessage, HostMessage } from '../shared/types.ts';
/** 解析客户端消息；非法消息返回 null（丢弃即可）。 */
export declare function parseClientMessage(raw: string): ClientMessage | null;
/** 序列化宿主消息（JSON 单行）。 */
export declare function stringifyHostMessage(message: HostMessage): string;
