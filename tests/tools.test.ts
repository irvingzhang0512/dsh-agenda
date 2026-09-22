/**
 * 13 个工具测试：注册清单、信封结构、失败返回结构化结果而非抛错、render 可读。
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'
import { AgendaService } from '../src/core/agenda.ts'
import { registerAgendaTools, AGENDA_TOOL_NAMES } from '../src/host/tools.ts'
import { writeHolidaySeed } from './helpers.ts'

type Tool = {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: Record<string, unknown>, render: (args: unknown, value: unknown) => unknown }
  execute: (args: Record<string, unknown>, exec: { signal: { throwIfAborted(): void } }) => Promise<unknown>
}

async function makeTools(): Promise<{ tools: Map<string, Tool>, service: AgendaService, dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agenda-tools-'))
  const storage = new CsvAgendaStorage(dir)
  await storage.ensureLayout()
  await writeHolidaySeed(storage)
  const service = new AgendaService(storage, { now: () => new Date('2026-09-22T08:00:00.000Z') })
  const tools = new Map<string, Tool>()
  registerAgendaTools({ tools: { register: tool => {
    const registered = tool as Tool
    tools.set(registered.name, registered)
    return () => tools.delete(registered.name)
  } } }, { service })
  return { tools, service, dir }
}

const exec = { signal: { throwIfAborted: () => undefined } }

describe('工具注册', () => {
  it('注册 13 个且名称与契约一致', async () => {
    const { tools, dir } = await makeTools()
    try {
      expect(tools.size).toBe(13)
      for (const name of AGENDA_TOOL_NAMES) expect(tools.has(name), name).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('创建类工具', () => {
  it('agenda_create_event 返回 ok 信封 + snake_case 视图', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_event')!.execute({ title: '评审', start: '2026-09-25T15:00', category: '工作/防干烧/算法' }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.ok).toBe(true)
      expect(envelope.code).toBe('OK')
      const event = envelope.event as Record<string, unknown>
      expect(event.all_day).toBe(false)
      expect(event.calendar_type).toBe('solar')
      expect(event.start).toBe('2026-09-25T15:00')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('agenda_create_todo 返回 ok 信封', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_todo')!.execute({ title: '整理材料', date: '2026-09-24' }, exec)
      expect((result as Record<string, unknown>).ok).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('校验失败返回结构化失败而非抛错', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_event')!.execute({ title: '  ', start: '2026-09-25' }, exec)
      expect((result as Record<string, unknown>).ok).toBe(false)
      expect((result as Record<string, unknown>).code).toBe('INVALID_TITLE')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('查询类工具', () => {
  it('agenda_list_events 支持范围过滤', async () => {
    const { tools, dir } = await makeTools()
    try {
      await tools.get('agenda_create_event')!.execute({ title: 'A', start: '2026-09-25', all_day: true }, exec)
      await tools.get('agenda_create_event')!.execute({ title: 'B', start: '2026-10-05', all_day: true }, exec)
      const result = await tools.get('agenda_list_events')!.execute({ from: '2026-09-01', to: '2026-09-30' }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.count).toBe(1)
      expect((envelope.events as Array<Record<string, unknown>>)[0]!.title).toBe('A')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('agenda_get_statistics 返回聚合指标', async () => {
    const { tools, dir } = await makeTools()
    try {
      await tools.get('agenda_create_event')!.execute({ title: '全天', start: '2026-09-20', all_day: true }, exec)
      await tools.get('agenda_create_event')!.execute({ title: '评审', start: '2026-09-25T14:00', end: '2026-09-25T16:00' }, exec)
      await tools.get('agenda_create_todo')!.execute({ title: '待办', date: '2026-09-25' }, exec)
      const result = await tools.get('agenda_get_statistics')!.execute({ from: '2026-09-01', to: '2026-09-30' }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.event_count).toBe(2)
      expect(envelope.all_day_event_count).toBe(1)
      expect(envelope.event_hours).toBe(2)
      expect(envelope.todo_count).toBe(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('render 投影', () => {
  it('渲染为可读文本', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_event')!.execute({ title: '评审', start: '2026-09-25T15:00' }, exec)
      const blocks = tools.get('agenda_create_event')!.output.render({}, result) as Array<{ type: string, text: string }>
      expect(blocks[0]!.type).toBe('text')
      expect(blocks[0]!.text).toContain('评审')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
