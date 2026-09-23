/**
 * dsh-agenda — 13 个模型工具（需求 §13）。
 *
 * 约定：
 * - 每个工具返回统一结构化信封 { ok, code, message, ... }（C4）并带纯文本
 *   render 投影（C10）；失败以结构化错误码返回而非抛错；
 * - 业务规则一律在 AgendaService 内核执行，工具只做「参数 → 服务 → 信封」映射；
 * - 工具不触碰任何文件路径（数据目录由 Service 内部解析）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ParameterPropertySpec } from '@deepseek-ai/dsh-tools'
import type { AgendaEvent, AgendaTodo, CalendarType, DateRange, EventInput, EventPatch, TodoInput, TodoInstance, TodoPatch, TodoRecurrence } from '../shared/types.ts'
import type { AgendaService } from '../core/agenda.ts'
import { AgendaError } from '../core/errors.ts'

/** 工具名（与 SKILL/docs 契约保持一致）。 */
export const AGENDA_TOOL_NAMES = [
  'agenda_create_event',
  'agenda_get_event',
  'agenda_update_event',
  'agenda_delete_event',
  'agenda_list_events',
  'agenda_search_events',
  'agenda_create_todo',
  'agenda_update_todo',
  'agenda_complete_todo',
  'agenda_delete_todo',
  'agenda_list_todos',
  'agenda_search_todos',
  'agenda_get_statistics',
] as const

export type AgendaToolName = (typeof AGENDA_TOOL_NAMES)[number]

/** 工具依赖（注入以便测试）。 */
export interface AgendaToolDeps {
  service: AgendaService
}

/** 通用信封字段（每个工具都返回）。 */
const baseEnvelope = {
  ok: { type: 'boolean' as const, required: true as const, description: '是否成功。' },
  code: { type: 'string' as const, required: true as const, description: '状态 / 错误码。' },
  message: { type: 'string' as const, required: true as const, description: '人类可读的结果说明。' },
} satisfies Record<string, ParameterPropertySpec>

function outputWith<const E extends Record<string, ParameterPropertySpec>>(extra: E): {
  type: 'object'
  additionalProperties: false
  properties: typeof baseEnvelope & E
} {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...baseEnvelope,
      ...extra,
    },
  }
}

/** 单个日程对象 schema（农历字段为可选）。 */
const eventSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    id: { type: 'string' as const, required: true as const, description: '日程 id。' },
    title: { type: 'string' as const, required: true as const, description: '标题。' },
    start: { type: 'string' as const, required: true as const, description: '开始：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm。' },
    end: { type: 'string' as const, required: true as const, description: '结束：同上。' },
    all_day: { type: 'boolean' as const, required: true as const, description: '是否全天。' },
    calendar_type: { type: 'string' as const, required: true as const, enum: ['solar', 'lunar'] as const, description: '公历 / 农历。' },
    lunar_year: { type: 'number' as const, description: '原始农历年（农历事件）。' },
    lunar_month: { type: 'number' as const, description: '原始农历月（农历事件）。' },
    lunar_day: { type: 'number' as const, description: '原始农历日（农历事件）。' },
    lunar_leap: { type: 'boolean' as const, description: '农历闰月（农历事件）。' },
    category: { type: 'string' as const, description: '多级分类路径，如 工作/防干烧/算法。' },
    location: { type: 'string' as const, description: '地点。' },
    description: { type: 'string' as const, description: '备注。' },
    recurrence: { type: 'string' as const, description: '重复规则（当前仅 none）。' },
    created_at: { type: 'string' as const, description: '创建时间。' },
    updated_at: { type: 'string' as const, description: '更新时间。' },
  },
} satisfies ParameterPropertySpec

const eventArraySchema = {
  type: 'array' as const,
  items: eventSchema,
  description: '日程列表。',
} satisfies ParameterPropertySpec

/** 单个待办对象 schema。 */
const todoSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    id: { type: 'string' as const, required: true as const, description: '待办 id。' },
    title: { type: 'string' as const, required: true as const, description: '标题。' },
    date: { type: 'string' as const, required: true as const, description: '日期 YYYY-MM-DD（农历基准为换算后的公历日）。' },
    status: { type: 'string' as const, required: true as const, enum: ['pending', 'completed'] as const, description: '状态。' },
    recurrence: { type: 'string' as const, enum: ['daily', 'weekly', 'monthly', 'yearly'] as const, description: '重复粒度；缺省不重复。' },
    calendar_type: { type: 'string' as const, enum: ['solar', 'lunar'] as const, description: '基准日历类型；lunar 仅用于 yearly 重复。' },
    lunar_year: { type: 'number' as const, description: '原始农历年（lunar 基准）。' },
    lunar_month: { type: 'number' as const, description: '原始农历月（lunar 基准）。' },
    lunar_day: { type: 'number' as const, description: '原始农历日（lunar 基准）。' },
    lunar_leap: { type: 'boolean' as const, description: '农历闰月（lunar 基准）。' },
    completed_dates: { type: 'array' as const, items: { type: 'string' as const }, description: '重复待办已完成的实例日期。' },
    category: { type: 'string' as const, description: '多级分类路径。' },
    description: { type: 'string' as const, description: '备注。' },
    completed_at: { type: 'string' as const, description: '完成时间。' },
    created_at: { type: 'string' as const, description: '创建时间。' },
    updated_at: { type: 'string' as const, description: '更新时间。' },
  },
} satisfies ParameterPropertySpec

const todoArraySchema = {
  type: 'array' as const,
  items: todoSchema,
  description: '待办列表。',
} satisfies ParameterPropertySpec

/** 展开实例的输出 schema（agenda_list_todos 用）。 */
const todoInstanceSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    template_id: { type: 'string' as const, required: true as const, description: '所属模板待办 id。' },
    date: { type: 'string' as const, required: true as const, description: '实例日期 YYYY-MM-DD。' },
    title: { type: 'string' as const, required: true as const, description: '标题。' },
    status: { type: 'string' as const, required: true as const, enum: ['pending', 'completed'] as const, description: '实例完成状态。' },
    recurrence: { type: 'string' as const, enum: ['daily', 'weekly', 'monthly', 'yearly'] as const, description: '重复粒度。' },
    category: { type: 'string' as const, description: '多级分类路径。' },
    description: { type: 'string' as const, description: '备注。' },
  },
} satisfies ParameterPropertySpec

const todoInstanceArraySchema = {
  type: 'array' as const,
  items: todoInstanceSchema,
  description: '待办实例列表（重复待办按日期展开）。',
} satisfies ParameterPropertySpec

/** 可选日期范围参数（from/to 同时出现才生效）。 */
const dateRangeParams = {
  from: { type: 'string', description: '范围起始 YYYY-MM-DD（含）。' },
  to: { type: 'string', description: '范围结束 YYYY-MM-DD（含）。' },
} satisfies Record<string, ParameterPropertySpec>

/** 事件入参 schema（创建/修改共用字段，修改时只填出现字段）。 */
const eventInputParams = {
  title: { type: 'string', description: '标题（必填）。' },
  start: { type: 'string', description: '公历开始：YYYY-MM-DD（全天）或 YYYY-MM-DDTHH:mm（定时）。' },
  end: { type: 'string', description: '公历结束：同上；省略时全天=同日，定时=开始+1小时。' },
  all_day: { type: 'boolean', description: '是否全天；公历路径由 start 格式自动判定。' },
  calendar_type: { type: 'string', enum: ['solar', 'lunar'], description: '公历 / 农历；默认 solar。' },
  lunar_year: { type: 'number', description: '农历年（农历路径）。' },
  lunar_month: { type: 'number', description: '农历月 1-12（农历路径）。' },
  lunar_day: { type: 'number', description: '农历日 1-30（农历路径）。' },
  lunar_leap: { type: 'boolean', description: '是否闰月（农历路径）。' },
  start_time: { type: 'string', description: '农历事件开始时间 HH:mm（默认 09:00）。' },
  end_time: { type: 'string', description: '农历事件结束时间 HH:mm（默认 10:00）。' },
  category: { type: 'string', description: '多级分类路径，如 工作/防干烧/算法；首次引用自动登记。' },
  location: { type: 'string', description: '地点。' },
  description: { type: 'string', description: '备注。' },
} satisfies Record<string, ParameterPropertySpec>

const todoInputParams = {
  title: { type: 'string', description: '标题（必填）。' },
  date: { type: 'string', description: '日期 YYYY-MM-DD（农历基准传换算后的公历日，或省略由 lunar_* 自动换算）。' },
  recurrence: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: '重复粒度：每天/每周/每月/每年；缺省不重复。' },
  calendar_type: { type: 'string', enum: ['solar', 'lunar'], description: '基准日历类型；lunar 仅与 yearly 搭配（如每年农历生日）。' },
  lunar_year: { type: 'number', description: '农历年（lunar 基准，必填）。' },
  lunar_month: { type: 'number', description: '农历月 1-12（lunar 基准，必填）。' },
  lunar_day: { type: 'number', description: '农历日 1-30（lunar 基准，必填）。' },
  lunar_leap: { type: 'boolean', description: '是否闰月（lunar 基准）。' },
  category: { type: 'string', description: '多级分类路径。' },
  description: { type: 'string', description: '备注。' },
} satisfies Record<string, ParameterPropertySpec>

/** 纯文本投影。 */
function textOf(result: Record<string, unknown>): string {
  const lines: string[] = [`[${String(result.code)}] ${String(result.message)}`]
  if (result.count !== undefined) lines.push(`数量: ${String(result.count)}`)
  if (result.total !== undefined) lines.push(`总计: ${String(result.total)}`)
  if (result.event !== undefined && typeof result.event === 'object') {
    const event = result.event as EventView
    lines.push(`日程: ${event.title}（${event.start} → ${event.end}）${event.all_day ? '［全天］' : ''}${event.category !== undefined ? `［${event.category}］` : ''}`)
  }
  if (result.todo !== undefined && typeof result.todo === 'object') {
    const todo = result.todo as TodoView
    lines.push(`待办: ${todo.title}（${todo.date}，${todo.status === 'completed' ? '已完成' : '未完成'}）${todo.category !== undefined ? `［${todo.category}］` : ''}`)
  }
  if (Array.isArray(result.events) && result.events.length > 0) {
    for (const event of result.events as EventView[]) {
      lines.push(`  · ${event.start} ${event.all_day ? '［全天］' : ''}${event.title}${event.category !== undefined ? `［${event.category}］` : ''}`)
    }
  }
  if (Array.isArray(result.todos) && result.todos.length > 0) {
    for (const todo of result.todos as TodoView[]) {
      lines.push(`  · ${todo.date} ${todo.status === 'completed' ? '✓' : '○'}${todo.title}${todo.category !== undefined ? `［${todo.category}］` : ''}`)
    }
  }
  return lines.join('\n')
}

/** 日程 → 输出视图（snake_case，null 可选字段省略）。 */
interface EventView {
  id: string
  title: string
  start: string
  end: string
  all_day: boolean
  calendar_type: 'solar' | 'lunar'
  lunar_year?: number
  lunar_month?: number
  lunar_day?: number
  lunar_leap?: boolean
  category?: string
  location?: string
  description?: string
  recurrence: string
  created_at: string
  updated_at: string
}

function eventView(event: AgendaEvent): EventView {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    all_day: event.allDay,
    calendar_type: event.calendarType,
    ...(event.lunarYear !== undefined ? { lunar_year: event.lunarYear } : {}),
    ...(event.lunarMonth !== undefined ? { lunar_month: event.lunarMonth } : {}),
    ...(event.lunarDay !== undefined ? { lunar_day: event.lunarDay } : {}),
    ...(event.lunarLeap !== undefined ? { lunar_leap: event.lunarLeap } : {}),
    ...(event.category !== undefined ? { category: event.category } : {}),
    ...(event.location !== undefined ? { location: event.location } : {}),
    ...(event.description !== undefined ? { description: event.description } : {}),
    recurrence: event.recurrence,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  }
}

/** 待办 → 输出视图（snake_case，null 可选字段省略）。 */
interface TodoView {
  id: string
  title: string
  date: string
  status: 'pending' | 'completed'
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  calendar_type?: 'solar' | 'lunar'
  lunar_year?: number
  lunar_month?: number
  lunar_day?: number
  lunar_leap?: boolean
  completed_dates?: string[]
  category?: string
  description?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

function todoView(todo: AgendaTodo): TodoView {
  return {
    id: todo.id,
    title: todo.title,
    date: todo.date,
    status: todo.status,
    ...(todo.recurrence !== undefined ? { recurrence: todo.recurrence } : {}),
    ...(todo.calendarType !== undefined ? { calendar_type: todo.calendarType } : {}),
    ...(todo.lunarYear !== undefined ? { lunar_year: todo.lunarYear } : {}),
    ...(todo.lunarMonth !== undefined ? { lunar_month: todo.lunarMonth } : {}),
    ...(todo.lunarDay !== undefined ? { lunar_day: todo.lunarDay } : {}),
    ...(todo.lunarLeap !== undefined ? { lunar_leap: todo.lunarLeap } : {}),
    ...(todo.completedDates !== undefined ? { completed_dates: todo.completedDates } : {}),
    ...(todo.category !== undefined ? { category: todo.category } : {}),
    ...(todo.description !== undefined ? { description: todo.description } : {}),
    ...(todo.completedAt !== undefined ? { completed_at: todo.completedAt } : {}),
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
  }
}

/** 展开实例 → 输出视图（snake_case）。 */
interface TodoInstanceView {
  template_id: string
  date: string
  title: string
  status: 'pending' | 'completed'
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  category?: string
  description?: string
}

function todoInstanceView(instance: TodoInstance): TodoInstanceView {
  return {
    template_id: instance.templateId,
    date: instance.date,
    title: instance.title,
    status: instance.status,
    ...(instance.recurrence !== undefined ? { recurrence: instance.recurrence } : {}),
    ...(instance.category !== undefined ? { category: instance.category } : {}),
    ...(instance.description !== undefined ? { description: instance.description } : {}),
  }
}

/** 把服务层错误映射为失败信封。 */
function failureOf(error: unknown): { ok: false, code: string, message: string } {
  if (error instanceof AgendaError) {
    return { ok: false, code: error.code, message: error.message }
  }
  const text = error instanceof Error ? error.message : String(error)
  return { ok: false, code: 'INTERNAL_ERROR', message: `日程服务执行失败: ${text}` }
}

function success(code: string, message: string): { ok: true, code: string, message: string } {
  return { ok: true, code, message }
}

/** 解析可选日期范围参数。 */
function rangeOf(args: Record<string, unknown>): DateRange | undefined {
  const from = typeof args.from === 'string' && args.from !== '' ? args.from : undefined
  const to = typeof args.to === 'string' && args.to !== '' ? args.to : undefined
  if (from === undefined || to === undefined) return undefined
  return { from, to }
}

/** 注册 13 个工具；返回组合 disposer。 */
export function registerAgendaTools(ctx: { tools: { register(tool: unknown): () => void } }, deps: AgendaToolDeps): () => void {
  const disposers: Array<() => void> = []
  const service = deps.service

  // ── Event ───────────────────────────────────────────────────────────────
  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_create_event',
    description:
      '新建日程（公历或农历）。公历：start 传 YYYY-MM-DD（全天）或 YYYY-MM-DDTHH:mm（定时），end 可省略（全天=同日，定时=开始+1小时）。'
      + '农历：calendar_type=lunar 并传 lunar_year/lunar_month/lunar_day（可带 lunar_leap 与 start_time/end_time），'
      + '系统换算为公历并保留原始农历字段。适合「明天下午三点安排算法评审」「添加农历八月十五全家聚餐」。',
    parameters: eventInputParams,
    output: {
      schema: outputWith({ event: eventSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const event = await service.createEvent(cleanEventInput(args as unknown as Record<string, unknown>))
        return { ...success('OK', '日程已创建。'), event: eventView(event) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_get_event',
    description: '查看单个日程详情（id 必填）。',
    parameters: {
      id: { type: 'string', description: '日程 id（e_ 开头）。' },
    },
    output: {
      schema: outputWith({ event: eventSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const event = await service.getEvent(String(args.id))
        if (event === null) return { ...failureOf(new AgendaError('NOT_FOUND', `日程不存在: ${String(args.id)}`)) }
        return { ...success('OK', '已获取日程。'), event: eventView(event) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_update_event',
    description:
      '修改日程（只填要改的字段；title/category/location/description 传空串可清除）。'
      + '改变日期走同一套公历/农历规则：切到农历需给 calendar_type=lunar 与 lunar_year/month/day；切回公历给 calendar_type=solar 与 start。',
    parameters: {
      id: { type: 'string', description: '日程 id（e_ 开头）。' },
      ...eventInputParams,
    },
    output: {
      schema: outputWith({ event: eventSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const patch = cleanEventInput(args as unknown as Record<string, unknown>)
        const event = await service.updateEvent(String(args.id), patch as EventPatch)
        return { ...success('OK', '日程已更新。'), event: eventView(event) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_delete_event',
    description: '删除日程（id 必填）。删除前应确认，属破坏性操作。',
    parameters: {
      id: { type: 'string', description: '日程 id（e_ 开头）。' },
    },
    output: {
      schema: outputWith({ deleted_id: { type: 'string', description: '被删除的日程 id。' } }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        await service.deleteEvent(String(args.id))
        return { ...success('OK', '日程已删除。'), deleted_id: String(args.id) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_list_events',
    description:
      '列出日程。可传 from/to（YYYY-MM-DD）限定范围（含当日），省略则返回全部。'
      + '适合「这个月有什么安排」「下周的日程」「今天还有什么事情」。',
    parameters: dateRangeParams,
    output: {
      schema: outputWith({
        events: eventArraySchema,
        count: { type: 'number', description: '返回条数。' },
      }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const events = await service.listEvents(rangeOf(args))
        return { ...success('OK', `共 ${events.length} 条日程。`), events: events.map(eventView), count: events.length }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_search_events',
    description:
      '搜索日程（匹配 title / description / category，大小写不敏感）。可传 from/to 限定日期范围。'
      + '适合「查一下这个月和第二技术路线有关的安排」。',
    parameters: {
      query: { type: 'string', description: '搜索词（必填）。' },
      ...dateRangeParams,
    },
    output: {
      schema: outputWith({
        events: eventArraySchema,
        total: { type: 'number', description: '命中总数（截断前）。' },
        truncated: { type: 'boolean', description: '是否因超上限被截断。' },
      }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const result = await service.search(String(args.query), { eventsRange: rangeOf(args) })
        return { ...success('OK', `命中 ${result.eventTotal} 条日程。`), events: result.events.map(eventView), total: result.eventTotal, truncated: result.truncated }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  // ── Todo ────────────────────────────────────────────────────────────────
  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_create_todo',
    description:
      '新建待办。date 为 YYYY-MM-DD；支持重复（recurrence=daily/weekly/monthly/yearly，如每周一开会提醒）'
      + '与农历每年重复（calendar_type=lunar 且 recurrence=yearly，如每年农历八月十五家人生日）。'
      + '适合「添加一个待办：整理算法评审材料」。',
    parameters: todoInputParams,
    output: {
      schema: outputWith({ todo: todoSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const todo = await service.createTodo(cleanTodoCreateInput(cleanTodoInput(args as unknown as Record<string, unknown>)))
        return { ...success('OK', '待办已创建。'), todo: todoView(todo) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_update_todo',
    description:
      '修改待办（只填要改的字段：title/date/category/description/recurrence/calendar_type/lunar_*）。'
      + 'recurrence 传空串可清除重复。适合「把这个待办改成每周重复」「把待办改到明天」。',
    parameters: {
      id: { type: 'string', description: '待办 id（t_ 开头）。' },
      ...todoInputParams,
    },
    output: {
      schema: outputWith({ todo: todoSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const todo = await service.updateTodo(String(args.id), cleanTodoInput(args as unknown as Record<string, unknown>) as TodoPatch)
        return { ...success('OK', '待办已更新。'), todo: todoView(todo) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_complete_todo',
    description:
      '完成待办（status → completed）。单次待办直接完成；重复待办可传 date 完成指定日期实例'
      + '（缺省完成下一个未完成实例）。再次调用同效果。',
    parameters: {
      id: { type: 'string', description: '待办 id（t_ 开头）。' },
      date: { type: 'string', description: '实例日期 YYYY-MM-DD（重复待办可选；缺省完成下一次）。' },
    },
    output: {
      schema: outputWith({ todo: todoSchema }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const date = typeof args.date === 'string' && args.date !== '' ? args.date : undefined
        const todo = await service.setTodoStatus(String(args.id), 'completed', date)
        return { ...success('OK', '待办已完成。'), todo: todoView(todo) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_delete_todo',
    description: '删除待办（id 必填）。',
    parameters: {
      id: { type: 'string', description: '待办 id（t_ 开头）。' },
    },
    output: {
      schema: outputWith({ deleted_id: { type: 'string', description: '被删除的待办 id。' } }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        await service.deleteTodo(String(args.id))
        return { ...success('OK', '待办已删除。'), deleted_id: String(args.id) }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_list_todos',
    description:
      '列出待办（按日期展开为实例：重复待办会在每个到期日出现一条，带 recurrence 与 template_id）。'
      + '可传 from/to 限定日期、status=pending|completed 过滤，省略则返回全部。'
      + '适合「今天有什么待办」「这周未完成的待办」。',
    parameters: {
      ...dateRangeParams,
      status: { type: 'string', enum: ['pending', 'completed'], description: '按状态过滤。' },
    },
    output: {
      schema: outputWith({
        todos: todoInstanceArraySchema,
        count: { type: 'number', description: '返回条数。' },
      }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const status = args.status === 'completed' ? 'completed' : args.status === 'pending' ? 'pending' : undefined
        const instances = await service.listTodoInstances(rangeOf(args), status)
        return { ...success('OK', `共 ${instances.length} 条待办。`), todos: instances.map(todoInstanceView), count: instances.length }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_search_todos',
    description: '搜索待办（匹配 title / category，大小写不敏感）。可传 from/to 限定日期。',
    parameters: {
      query: { type: 'string', description: '搜索词（必填）。' },
      ...dateRangeParams,
    },
    output: {
      schema: outputWith({
        todos: todoArraySchema,
        total: { type: 'number', description: '命中总数（截断前）。' },
        truncated: { type: 'boolean', description: '是否因超上限被截断。' },
      }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const result = await service.search(String(args.query), { todosRange: rangeOf(args) })
        return { ...success('OK', `命中 ${result.todoTotal} 条待办。`), todos: result.todos.map(todoView), total: result.todoTotal, truncated: result.truncated }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  // ── 统计 ────────────────────────────────────────────────────────────────
  disposers.push(ctx.tools.register(defineTool({
    name: 'agenda_get_statistics',
    description:
      '获取统计（需求 §10）：范围内 Event/Todo 数量、完成情况、按分类聚合与定时事件时间投入。'
      + 'from/to 必填（YYYY-MM-DD），适合「这周忙不忙」「统计一下这个月的安排」。',
    parameters: {
      from: { type: 'string', description: '范围起始 YYYY-MM-DD（必填）。' },
      to: { type: 'string', description: '范围结束 YYYY-MM-DD（必填）。' },
    },
    output: {
      schema: outputWith({
        range: {
          type: 'object' as const,
          additionalProperties: false as const,
          properties: {
            from: { type: 'string' as const, description: '起始。' },
            to: { type: 'string' as const, description: '结束。' },
          },
          description: '统计范围。',
        },
        event_count: { type: 'number', description: '日程总数。' },
        all_day_event_count: { type: 'number', description: '全天日程数。' },
        event_hours: { type: 'number', description: '定时日程总时长（小时）。' },
        todo_count: { type: 'number', description: '待办总数。' },
        todo_completed: { type: 'number', description: '已完成待办数。' },
        todo_pending: { type: 'number', description: '未完成待办数。' },
        todo_completion_rate: { type: 'number', description: '完成率 0-1。' },
        by_category: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            additionalProperties: false as const,
            properties: {
              category: { type: 'string' as const, required: true as const, description: '分类路径。' },
              event_count: { type: 'number' as const, required: true as const, description: '日程数。' },
              todo_count: { type: 'number' as const, required: true as const, description: '待办数。' },
              event_hours: { type: 'number' as const, required: true as const, description: '定时日程时长（小时）。' },
            },
          },
          description: '按分类聚合。',
        },
      }),
      render: (_args, value) => [{ type: 'text', text: textOf(value as never) }],
    },
    execute: async (args, exec) => {
      exec.signal.throwIfAborted()
      try {
        const from = String(args.from)
        const to = String(args.to)
        const stats = await service.statistics({ from, to })
        return {
          ...success('OK', `统计完成：日程 ${stats.eventCount} 条，待办 ${stats.todoCount} 条。`),
          range: stats.range,
          event_count: stats.eventCount,
          all_day_event_count: stats.allDayEventCount,
          event_hours: stats.eventHours,
          todo_count: stats.todoCount,
          todo_completed: stats.todoCompleted,
          todo_pending: stats.todoPending,
          todo_completion_rate: stats.todoCompletionRate,
          by_category: stats.byCategory.map(row => ({
            category: row.category,
            event_count: row.eventCount,
            todo_count: row.todoCount,
            event_hours: row.eventHours,
          })),
        }
      } catch (error) {
        return failureOf(error)
      }
    },
  })))

  return () => {
    for (const dispose of disposers) dispose()
  }
}

/** 把工具参数清洗成服务层输入（丢弃未出现的字段）。 */
function cleanEventInput(args: Record<string, unknown>): EventInput {
  const input: EventInput = { title: '' }
  const take = (key: string): unknown => args[key]
  if (typeof take('title') === 'string') input.title = String(take('title'))
  if (typeof take('start') === 'string') input.start = String(take('start'))
  if (typeof take('end') === 'string') input.end = String(take('end'))
  if (typeof take('all_day') === 'boolean') input.allDay = Boolean(take('all_day'))
  if (take('calendar_type') === 'lunar') input.calendarType = 'lunar'
  if (typeof take('lunar_year') === 'number') input.lunarYear = Number(take('lunar_year'))
  if (typeof take('lunar_month') === 'number') input.lunarMonth = Number(take('lunar_month'))
  if (typeof take('lunar_day') === 'number') input.lunarDay = Number(take('lunar_day'))
  if (typeof take('lunar_leap') === 'boolean') input.lunarLeap = Boolean(take('lunar_leap'))
  if (typeof take('start_time') === 'string') input.startTime = String(take('start_time'))
  if (typeof take('end_time') === 'string') input.endTime = String(take('end_time'))
  if (take('category') !== undefined && take('category') !== null) input.category = String(take('category'))
  if (typeof take('location') === 'string') input.location = String(take('location'))
  if (typeof take('description') === 'string') input.description = String(take('description'))
  return input
}

/** 清洗后的待办输入：recurrence/calendarType 支持 null（清除，仅 update 语义）。 */
interface CleanTodoInput {
  title: string
  date: string
  category?: string
  description?: string
  recurrence?: TodoRecurrence | null
  calendarType?: CalendarType | null
  lunarYear?: number
  lunarMonth?: number
  lunarDay?: number
  lunarLeap?: boolean
}

/** 把工具参数清洗成服务层输入。 */
function cleanTodoInput(args: Record<string, unknown>): CleanTodoInput {
  const input: CleanTodoInput = { title: '', date: '' }
  if (typeof args.title === 'string') input.title = args.title
  if (typeof args.date === 'string') input.date = args.date
  if (typeof args.category === 'string') input.category = args.category
  if (typeof args.description === 'string') input.description = args.description
  if (args.recurrence === 'daily' || args.recurrence === 'weekly' || args.recurrence === 'monthly' || args.recurrence === 'yearly') {
    input.recurrence = args.recurrence
  } else if (args.recurrence === '') {
    input.recurrence = null // 清除重复
  }
  if (args.calendar_type === 'lunar') input.calendarType = 'lunar'
  else if (args.calendar_type === 'solar') input.calendarType = 'solar'
  else if (args.calendar_type === '') input.calendarType = null // 清除农历基准
  if (typeof args.lunar_year === 'number') input.lunarYear = Number(args.lunar_year)
  if (typeof args.lunar_month === 'number') input.lunarMonth = Number(args.lunar_month)
  if (typeof args.lunar_day === 'number') input.lunarDay = Number(args.lunar_day)
  if (typeof args.lunar_leap === 'boolean') input.lunarLeap = Boolean(args.lunar_leap)
  return input
}

/** create 场景：把 CleanTodoInput 剥成 TodoInput（null → undefined）。 */
function cleanTodoCreateInput(input: CleanTodoInput): TodoInput {
  return {
    title: input.title,
    date: input.date,
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.recurrence !== undefined && input.recurrence !== null ? { recurrence: input.recurrence } : {}),
    ...(input.calendarType !== undefined && input.calendarType !== null ? { calendarType: input.calendarType } : {}),
    ...(input.lunarYear !== undefined ? { lunarYear: input.lunarYear } : {}),
    ...(input.lunarMonth !== undefined ? { lunarMonth: input.lunarMonth } : {}),
    ...(input.lunarDay !== undefined ? { lunarDay: input.lunarDay } : {}),
    ...(input.lunarLeap !== undefined ? { lunarLeap: input.lunarLeap } : {}),
  }
}
