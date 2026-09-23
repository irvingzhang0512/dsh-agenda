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

describe('重复待办工具（V0.2）', () => {
  it('agenda_create_todo 支持 recurrence 并返回信封', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_todo')!.execute({ title: '周会', date: '2026-09-01', recurrence: 'weekly' }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.ok).toBe(true)
      expect((envelope.todo as Record<string, unknown>).recurrence).toBe('weekly')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('agenda_create_todo 支持农历每年重复（lunar 字段）', async () => {
    const { tools, dir } = await makeTools()
    try {
      const result = await tools.get('agenda_create_todo')!.execute({
        title: '家人生日', date: '2026-09-25', recurrence: 'yearly',
        calendar_type: 'lunar', lunar_year: 2026, lunar_month: 8, lunar_day: 15,
      }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.ok).toBe(true)
      const todo = envelope.todo as Record<string, unknown>
      expect(todo.calendar_type).toBe('lunar')
      expect(todo.lunar_day).toBe(15)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('agenda_list_todos 返回展开实例（template_id + recurrence）', async () => {
    const { tools, dir } = await makeTools()
    try {
      await tools.get('agenda_create_todo')!.execute({ title: '周会', date: '2026-09-01', recurrence: 'weekly' }, exec)
      const result = await tools.get('agenda_list_todos')!.execute({ from: '2026-09-01', to: '2026-09-30' }, exec)
      const envelope = result as Record<string, unknown>
      const todos = envelope.todos as Array<Record<string, unknown>>
      expect(todos).toHaveLength(5)
      expect(todos[0]!.template_id).toBeTypeOf('string')
      expect(todos[0]!.recurrence).toBe('weekly')
      expect(todos[0]!.date).toBe('2026-09-01')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('agenda_complete_todo 支持 date 参数完成指定实例', async () => {
    const { tools, dir } = await makeTools()
    try {
      const created = await tools.get('agenda_create_todo')!.execute({ title: '周会', date: '2026-09-01', recurrence: 'weekly' }, exec)
      const id = ((created as Record<string, unknown>).todo as Record<string, unknown>).id as string
      const result = await tools.get('agenda_complete_todo')!.execute({ id, date: '2026-09-08' }, exec)
      const envelope = result as Record<string, unknown>
      expect(envelope.ok).toBe(true)
      expect((envelope.todo as Record<string, unknown>).completed_dates).toEqual(['2026-09-08'])
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
