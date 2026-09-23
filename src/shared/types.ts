/**
 * dsh-agenda — 共享领域类型与线协议。
 *
 * 本文件被 host 半（Node）与 client 半（浏览器）同时引用，必须保持：
 * - 零运行时依赖（只允许纯函数与类型）；
 * - 只使用 JSON 可序列化的结构（WebSocket 线协议直接承载这些类型）。
 */

// ─── 领域对象 ─────────────────────────────────────────────────────────────

/** 日历类型：公历事件直接用 start/end；农历事件额外保留原始农历字段。 */
export type CalendarType = 'solar' | 'lunar'

/** Event（日程）：核心业务对象之一。 */
export interface AgendaEvent {
  /** 稳定唯一 id（主机侧生成，`e_` + 时间戳 + 随机段）。 */
  id: string
  title: string
  /** 开始时间：`YYYY-MM-DD`（all_day）或 `YYYY-MM-DDTHH:mm`。 */
  start: string
  /** 结束时间：同上；all_day 事件与 start 同日。 */
  end: string
  allDay: boolean
  /** 日历类型；lunar 时下方 lunar* 字段必填。 */
  calendarType: CalendarType
  /** 原始农历月（1-12）；仅 lunar 事件。 */
  lunarMonth?: number
  /** 原始农历日（1-30）；仅 lunar 事件。 */
  lunarDay?: number
  /** 原始农历月是否闰月；仅 lunar 事件。 */
  lunarLeap?: boolean
  /** 原始农历年（用于无损还原）；仅 lunar 事件。 */
  lunarYear?: number
  /** 多级分类路径，如 `工作/防干烧/算法`。 */
  category?: string
  location?: string
  description?: string
  /** 重复规则；V0.1 仅 `none`（预留字段）。 */
  recurrence: string
  createdAt: string
  updatedAt: string
}

/** Todo（待办）状态。 */
export type TodoStatus = 'pending' | 'completed'

/** 待办重复粒度（缺省 = 不重复）；仅 yearly 支持农历基准。 */
export type TodoRecurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Todo（待办）：与 Event 分开管理的核心业务对象。 */
export interface AgendaTodo {
  id: string
  title: string
  /** 归属日期 `YYYY-MM-DD`（公历基准；农历基准为换算后的公历日）。 */
  date: string
  status: TodoStatus
  category?: string
  description?: string
  /** 完成时间（ISO-8601）；仅单次待办 completed。 */
  completedAt?: string
  /** 重复粒度；缺省 = 不重复。 */
  recurrence?: TodoRecurrence
  /** 基准日历类型；`lunar` 仅与 `recurrence: 'yearly'` 搭配（农历每年重复）。 */
  calendarType?: CalendarType
  /** 原始农历月（1-12）；仅 lunar 基准。 */
  lunarMonth?: number
  /** 原始农历日（1-30）；仅 lunar 基准。 */
  lunarDay?: number
  /** 原始农历月是否闰月；仅 lunar 基准。 */
  lunarLeap?: boolean
  /** 原始农历年；仅 lunar 基准（用于无损还原）。 */
  lunarYear?: number
  /** 重复待办的完成实例日期（YYYY-MM-DD）；单次待办仍用 status/completedAt。 */
  completedDates?: string[]
  createdAt: string
  updatedAt: string
}

/** 重复待办按日期展开后的一个实例（列表/统计/工具输出用）。 */
export interface TodoInstance {
  /** 所属模板 todo.id。 */
  templateId: string
  /** 实例日期 `YYYY-MM-DD`。 */
  date: string
  title: string
  category?: string
  description?: string
  /** 实例级完成状态（重复待办 = completedDates 命中该日期）。 */
  status: TodoStatus
  /** 所属模板的重复粒度；单次待办省略。 */
  recurrence?: TodoRecurrence
}

/** 全量快照：WS 连接建立与每次变更后广播。 */
export interface AgendaSnapshot {
  events: AgendaEvent[]
  todos: AgendaTodo[]
  categories: string[]
  settings: AgendaSettings
  /** 数据版本号：每次成功变更 +1。 */
  dataVersion: number
}

/** 用户设置（settings.yaml）。 */
export interface AgendaSettings {
  /** 周起始：`monday` | `sunday`。 */
  weekStart: 'monday' | 'sunday'
}

// ─── 日历信息（host 计算后下发给 UI）────────────────────────────────────

/** 一天的日历呈现信息（公历 + 农历 + 节假日）。 */
export interface DayInfo {
  /** `YYYY-MM-DD`。 */
  date: string
  /** 周几，1=周一 … 7=周日。 */
  weekday: number
  /** 农历展示文本：初一显示月名（如「八月」），否则日名（如「十五」）。 */
  lunarText: string
  /** 农历年（用于需要完整农历信息的场合）。 */
  lunarYear: number
  /** 是否农历闰月日。 */
  lunarLeap: boolean
  /** 当天类型。 */
  dayType: DayType
  /** 节假日名（如「春节」）；非节假日省略。 */
  holidayName?: string
  /** 农历传统节日名（春节/元宵/端午/七夕/中秋/重阳/除夕）；无则省略。 */
  festival?: string
  /** 是否今天。 */
  isToday: boolean
}

/** 日期类型：正常工作日 / 周末 / 法定节假日（休）/ 调休上班（班）。 */
export type DayType = 'workday' | 'weekend' | 'holiday' | 'adjusted-workday'

// ─── 写入输入（tool 与 UI 共用）─────────────────────────────────────────

/** 创建/修改 Event 的输入；日期规则见 AgendaService。 */
export interface EventInput {
  title: string
  /** 公历路径：start/end 二选一（与 lunar 字段互斥）。 */
  start?: string
  end?: string
  allDay?: boolean
  /** 农历路径：calendarType='lunar' 时使用。 */
  calendarType?: CalendarType
  lunarYear?: number
  lunarMonth?: number
  lunarDay?: number
  lunarLeap?: boolean
  /** 农历事件仅带时间（HH:mm）时按当日换算。 */
  startTime?: string
  endTime?: string
  category?: string
  location?: string
  description?: string
}

/** 修改 Event 的补丁（仅出现字段生效）。category/location/description 传空串或 null 表示清除。 */
export type EventPatch = Partial<Omit<EventInput, 'title' | 'category' | 'location' | 'description'>> & {
  title?: string
  category?: string | null
  location?: string | null
  description?: string | null
}

/** 创建/修改 Todo 的输入。 */
export interface TodoInput {
  title: string
  date: string
  category?: string
  description?: string
  /** 重复粒度；缺省 = 不重复。 */
  recurrence?: TodoRecurrence
  /** 基准日历类型；`lunar` 仅与 `recurrence: 'yearly'` 搭配。 */
  calendarType?: CalendarType
  lunarYear?: number
  lunarMonth?: number
  lunarDay?: number
  lunarLeap?: boolean
}

export type TodoPatch = Partial<Omit<TodoInput, 'recurrence' | 'calendarType'>> & {
  status?: TodoStatus
  /** 与 status 配合：完成/重开重复待办的指定日期实例；缺省作用于模板级（单次待办）或最近一次实例。 */
  statusDate?: string
  /** 重复粒度；null 表示清除（改为不重复）。 */
  recurrence?: TodoRecurrence | null
  /** 基准日历类型；null 表示清除（切回公历）。lunar 仅与 yearly 搭配。 */
  calendarType?: CalendarType | null
}

// ─── 统计 ────────────────────────────────────────────────────────────────

/** 统计时间范围。 */
export interface DateRange {
  /** `YYYY-MM-DD`（含）。 */
  from: string
  /** `YYYY-MM-DD`（含）。 */
  to: string
}

/** 按分类聚合的一行。 */
export interface CategoryStatRow {
  category: string
  eventCount: number
  todoCount: number
  /** 定时事件时间投入（小时）。 */
  eventHours: number
}

/** 统计结果。 */
export interface StatisticsResult {
  range: DateRange
  eventCount: number
  allDayEventCount: number
  todoCount: number
  todoCompleted: number
  todoPending: number
  /** 完成率 0-1（无待办时为 0）。 */
  todoCompletionRate: number
  /** 定时事件总时长（小时）。 */
  eventHours: number
  byCategory: CategoryStatRow[]
}

// ─── 搜索 ────────────────────────────────────────────────────────────────

/** 搜索结果（Event 与 Todo 的联合）。 */
export interface SearchResult {
  events: AgendaEvent[]
  todos: AgendaTodo[]
  /** 各自命中总数（截断前）。 */
  eventTotal: number
  todoTotal: number
  truncated: boolean
}

// ─── WS 线协议 ───────────────────────────────────────────────────────────

/** 客户端 → 宿主消息。 */
export type ClientMessage =
  | { type: 'hello' }
  | { type: 'op', id: string, op: ClientOp, args?: Record<string, unknown> }

/** 客户端可请求的操作（UI 与 Agent 工具共用同一套 Service）。 */
export type ClientOp =
  | 'get-snapshot'
  | 'calendar-info'
  | 'create-event'
  | 'update-event'
  | 'delete-event'
  | 'create-todo'
  | 'update-todo'
  | 'delete-todo'
  | 'todo-instances'
  | 'create-category'
  | 'delete-category'
  | 'statistics'
  | 'search'

/** 宿主 → 客户端消息。 */
export type HostMessage =
  | { type: 'snapshot', snapshot: AgendaSnapshot }
  | {
      type: 'op-result'
      id: string
      ok: boolean
      message: string
      result?: unknown
    }
  | { type: 'error', message: string }

// ─── 日期纯函数（host/client 共用，UTC 基准避免时区问题）────────────────

/** 日期正则：YYYY-MM-DD。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** 日期时间正则：YYYY-MM-DDTHH:mm。 */
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
/** 时间正则：HH:mm。 */
export const TIME_RE = /^\d{2}:\d{2}$/

/** 把 `YYYY-MM-DD` 解析为 UTC 零点的 Date；非法返回 null。 */
export function parseDate(date: string): Date | null {
  if (!DATE_RE.test(date)) return null
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const utc = new Date(Date.UTC(y, m - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null
  return utc
}

/** Date → `YYYY-MM-DD`（UTC 基准）。 */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 天数差：target - base（按 UTC 日历日）。 */
export function diffDays(base: string, target: string): number {
  const b = parseDate(base)
  const t = parseDate(target)
  if (b === null || t === null) return 0
  return Math.round((t.getTime() - b.getTime()) / 86400000)
}

/** 基准日 + n 天 → `YYYY-MM-DD`。 */
export function addDays(date: string, days: number): string {
  const base = parseDate(date)
  if (base === null) return date
  return formatDate(new Date(base.getTime() + days * 86400000))
}

/** 事件占用的日期闭区间（跨天事件展开为逐日）。
 * 定时事件结束于次日 00:00 时视为只占用开始日（20:00-24:00 不占第二天）。 */
export function eventDates(event: AgendaEvent): string[] {
  const startDay = event.start.slice(0, 10)
  let endDay = event.end.slice(0, 10)
  if (!event.allDay && event.end.length >= 16 && event.end.endsWith('T00:00') && endDay > startDay) {
    endDay = addDays(endDay, -1)
  }
  if (endDay < startDay) endDay = startDay
  const days: string[] = []
  let cursor = startDay
  let guard = 0
  while (cursor <= endDay && guard < 370) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return days
}

/** 事件是否覆盖某一天。 */
export function eventOverlapsDate(event: AgendaEvent, date: string): boolean {
  const days = eventDates(event)
  return days.length === 1 ? days[0] === date : days.includes(date)
}

/** 今天（本地时区）的 `YYYY-MM-DD`。 */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
