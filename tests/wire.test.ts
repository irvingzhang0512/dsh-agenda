/**
 * 线协议测试：客户端消息解析与宿主消息序列化。
 */
import { describe, expect, it } from 'vitest'
import { parseClientMessage, stringifyHostMessage } from '../src/shared/wire.ts'

describe('parseClientMessage', () => {
  it('解析 op 消息', () => {
    const message = parseClientMessage(JSON.stringify({ type: 'op', id: 'op_1', op: 'create-event', args: { title: 'x' } }))
    expect(message).toEqual({ type: 'op', id: 'op_1', op: 'create-event', args: { title: 'x' } })
  })

  it('解析 hello 消息', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'hello' }))).toEqual({ type: 'hello' })
  })

  it('非法 / 未知类型返回 null', () => {
    expect(parseClientMessage('not json')).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: 'nope' }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: 'op', op: 'x' }))).toBeNull() // 缺 id
    expect(parseClientMessage('')).toBeNull()
  })
})

describe('stringifyHostMessage', () => {
  it('快照可序列化为单行 JSON', () => {
    const snapshot = { events: [], todos: [], categories: [], settings: { weekStart: 'monday' }, dataVersion: 0 }
    const text = stringifyHostMessage({ type: 'snapshot', snapshot })
    const parsed = JSON.parse(text) as { type: string }
    expect(parsed.type).toBe('snapshot')
    expect(text).not.toContain('\n')
  })
})
