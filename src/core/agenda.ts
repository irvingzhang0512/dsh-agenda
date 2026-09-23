/**
 * dsh-agenda — AgendaService：UI、Agent Tool、Skill 共用的唯一业务层。
 *
 * 数据流（需求 §18）：
 *   UI / Voice / Text → (Bridge | DSH Agent) → AgendaService → AgendaStorage → 本地文件
 *
 * 职责：
 * - Event/Todo 的确定性 CRUD（含公历/农历两条创建路径与校验）；
 * - 分类（首次引用自动登记）；
 * - 日历信息（农历 + 节假日 + 周末 的 DayInfo）；
 * - 统计与搜索；
 * - 快照（WS 广播用）与 dataVersion。
 *
 * 农历事件（需求 §7）：保留原始 lunar_year/month/day/leap 字段，同时落
 * 换算后的公历 start/end；V0.1 仅支持单日农历事件。
 */
import {
  DATE_RE, DATETIME_RE, TIME_RE,
  addDays, eventDates, parseDate, todayISO,
} from '../shared/types.ts'
import type {
  AgendaEvent, AgendaSettings, AgendaSnapshot, AgendaTodo, CalendarType, DateRange, DayInfo,
  EventInput, EventPatch, SearchResult, StatisticsResult, TodoInput, TodoInstance,
  TodoPatch, TodoRecurrence,
} from '../shared/types.ts'
import type { AgendaStorage } from '../storage/storage.ts'
import { HolidayService } from './holidays.ts'
import { AgendaError } from './errors.ts'
import { normalizeCategoryPath } from './categories.ts'
import { todoOccurrenceDates } from './recurrence.ts'
import {
  isLunarNewYearEve, lunarCellText, lunarFestivalOf, lunarToSolar,
  LUNAR_MAX_YEAR, LUNAR_MIN_YEAR, nextDay, solarToLunar,
} from './lunar.ts'

/** 默认设置。 */
const DEFAULT_SETTINGS: AgendaSettings = { weekStart: 'monday' }
/** calendarInfo 支持的最大天数（防止滥用）。 */
const MAX_CALENDAR_DAYS = 400
/** 待办实例查询的最大天数（重复待办尤其 yearly 需要跨年查询）。 */
const MAX_TODO_RANGE_DAYS = 3660
/** 搜索结果截断上限。 */
const SEARCH_LIMIT = 100

/** 生成带前缀的稳定 id。 */
function newId(prefix: string): string {
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${time}${random}`
}

/** AgendaService 门面。 */
export class AgendaService {
  private readonly storage: AgendaStorage
  readonly holidays: HolidayService
  private readonly now: () => Date
  private dataVersion = 0

  constructor(storage: AgendaStorage, options?: { now?: () => Date }) {
    this.storage = storage
    this.holidays = new HolidayService(storage)
    this.now = options?.now ?? (() => new Date())
  }

  /** 当前数据版本（每次成功变更 +1）。 */
  get version(): number {
    return this.dataVersion
  }

  private stamp(): { createdAt: string, updatedAt: string } {
    const now = this.now().toISOString()
    return { createdAt: now, updatedAt: now }
  }

  // ── 设置与快照 ─────────────────────────────────────────────────────────

  /** 读取设置（缺省时写入默认值）。 */
  async settings(): Promise<AgendaSettings> {
    const loaded = await this.storage.loadSettings()
    if (loaded !== null) return loaded
    await this.storage.saveSettings(DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS }
  }

  /** 全量快照（WS 建连与变更广播）。 */
  async snapshot(): Promise<AgendaSnapshot> {
    const [events, todos, categories, settings] = await Promise.all([
      this.storage.listEvents(),
      this.storage.listTodos(),
      this.storage.listCategories(),
      this.settings(),
    ])
    return {
      events: [...events].sort((a, b) => a.start.localeCompare(b.start)),
      todos: [...todos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      categories,
      settings,
      dataVersion: this.dataVersion,
    }
  }

  // ── Event ───────────────────────────────────────────────────────────────

  /** 创建日程；按 calendarType 走公历或农历路径。 */
  async createEvent(input: EventInput): Promise<AgendaEvent> {
    this.assertTitle(input.title)
    const category = this.eventCategory(input.category)
    await this.registerCategoryIfNew(category)
    const event: AgendaEvent = {
      id: newId('e'),
      title: input.title.trim(),
      start: '',
      end: '',
      allDay: input.allDay === true,
      calendarType: input.calendarType === 'lunar' ? 'lunar' : 'solar',
      recurrence: 'none',
      ...this.stamp(),
    }
    this.applyEventDates(event, input)
    this.applyEventExtras(event, input)
    if (category !== undefined) event.category = category
    await this.storage.mutateEvents(events => {
      if (events.some(existing => existing.id === event.id)) {
        throw new AgendaError('INVALID_ARGUMENT', `日程 id 冲突: ${event.id}`)
      }
      events.push(event)
      return { value: undefined }
    })
    this.dataVersion += 1
    return event
  }

  /** 查看单个日程。 */
  async getEvent(id: string): Promise<AgendaEvent | null> {
    const events = await this.storage.listEvents()
    return events.find(event => event.id === id) ?? null
  }

  /**
   * 修改日程：以「当前值 + 补丁」合并成一次完整输入后重走日期解析，
   * 保证无论公历→农历还是反向切换都能得到一致且可校验的结果。
   */
  async updateEvent(id: string, patch: EventPatch): Promise<AgendaEvent> {
    if (patch.title !== undefined) this.assertTitle(patch.title)
    const category = this.eventCategory(patch.category)
    await this.registerCategoryIfNew(category)
    const now = this.now().toISOString()
    const updated = await this.storage.mutateEvents(events => {
      const event = events.find(existing => existing.id === id)
      if (event === undefined) throw new AgendaError('NOT_FOUND', `日程不存在: ${id}`)

      const merged: EventInput = {
        title: patch.title !== undefined ? patch.title : event.title,
        calendarType: patch.calendarType ?? event.calendarType,
        allDay: patch.allDay ?? event.allDay,
      }
      if (merged.calendarType === 'lunar') {
        // 农历路径：start/end 由农历字段换算，忽略补丁里的公历字段
        merged.lunarYear = patch.lunarYear ?? event.lunarYear
        merged.lunarMonth = patch.lunarMonth ?? event.lunarMonth
        merged.lunarDay = patch.lunarDay ?? event.lunarDay
        merged.lunarLeap = patch.lunarLeap ?? event.lunarLeap
        merged.startTime = patch.startTime ?? this.timeOf(event.start)
        merged.endTime = patch.endTime ?? this.timeOf(event.end)
      } else {
        // 公历路径：start/end 直接取补丁或当前值
        merged.start = patch.start ?? event.start
        merged.end = patch.end
      }

      event.title = merged.title.trim()
      event.allDay = merged.allDay === true
      event.calendarType = merged.calendarType === 'lunar' ? 'lunar' : 'solar'
      this.applyEventDates(event, merged)
      this.applyEventExtras(event, merged)
      if (category !== undefined) event.category = category
      else if (patch.category !== undefined) delete event.category
      event.updatedAt = now
      return { value: event }
    })
    this.dataVersion += 1
    return updated
  }

  /** 删除日程；返回被删除对象。 */
  async deleteEvent(id: string): Promise<AgendaEvent> {
    const removed = await this.storage.mutateEvents(events => {
      const index = events.findIndex(event => event.id === id)
      if (index === -1) throw new AgendaError('NOT_FOUND', `日程不存在: ${id}`)
      const [event] = events.splice(index, 1)
      return { value: event }
    })
    this.dataVersion += 1
    return removed
  }

  /** 列出日期范围内的日程（默认全部，按开始时间排序）。 */
  async listEvents(range?: DateRange): Promise<AgendaEvent[]> {
    const events = await this.storage.listEvents()
    const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
    if (range === undefined) return sorted
    this.validateRange(range)
    return sorted.filter(event => {
      return eventDates(event).some(date => date >= range.from && date <= range.to)
    })
  }

  // ── Event：日期解析 ─────────────────────────────────────────────────────

  /** 按输入解析 start/end/allDay 并写回 event（农历路径完成换算）。 */
  private applyEventDates(event: AgendaEvent, input: EventInput): void {
    if (event.calendarType === 'lunar') {
      this.applyLunarDates(event, input)
      return
    }
    this.applySolarDates(event, input)
  }

  private applyLunarDates(event: AgendaEvent, input: EventInput): void {
    const lunarYear = input.lunarYear
    const lunarMonth = input.lunarMonth
    const lunarDay = input.lunarDay
    if (lunarYear === undefined || lunarMonth === undefined || lunarDay === undefined) {
      throw new AgendaError('INVALID_LUNAR', '农历日程需要 lunar_year / lunar_month / lunar_day。')
    }
    if (lunarYear < LUNAR_MIN_YEAR || lunarYear > LUNAR_MAX_YEAR) {
      throw new AgendaError('INVALID_LUNAR', `农历年份超出支持范围（${LUNAR_MIN_YEAR}–${LUNAR_MAX_YEAR}）: ${lunarYear}`)
    }
    if (lunarMonth < 1 || lunarMonth > 12) {
      throw new AgendaError('INVALID_LUNAR', `农历月份非法（1–12）: ${lunarMonth}`)
    }
    if (lunarDay < 1 || lunarDay > 30) {
      throw new AgendaError('INVALID_LUNAR', `农历日期非法（1–30）: ${lunarDay}`)
    }
    const isLeap = input.lunarLeap === true
    const solar = lunarToSolar({ lunarYear, lunarMonth, lunarDay, isLeap })
    if (solar === null) {
      throw new AgendaError('INVALID_LUNAR', `农历日期不存在: ${lunarYear}年${isLeap ? '闰' : ''}${lunarMonth}月${lunarDay}日`)
    }
    const allDay = event.allDay
    const startTime = input.startTime ?? '09:00'
    const endTime = input.endTime ?? '10:00'
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      throw new AgendaError('INVALID_DATE', '农历日程的 start_time / end_time 应为 HH:mm。')
    }
    if (endTime < startTime) {
      throw new AgendaError('INVALID_RANGE', `农历日程结束时间早于开始时间: ${startTime} → ${endTime}`)
    }
    event.start = allDay ? solar : `${solar}T${startTime}`
    event.end = allDay ? solar : `${solar}T${endTime}`
    event.lunarYear = lunarYear
    event.lunarMonth = lunarMonth
    event.lunarDay = lunarDay
    event.lunarLeap = isLeap
  }

  private applySolarDates(event: AgendaEvent, input: EventInput): void {
    const start = input.start?.trim()
    if (start === undefined || start === '') {
      throw new AgendaError('INVALID_DATE', '公历日程需要 start（YYYY-MM-DD 或 YYYY-MM-DDTHH:mm）。')
    }
    // 格式即权威：date-only → 全天；datetime → 定时
    const allDay = DATE_RE.test(start)
    if (!allDay && !DATETIME_RE.test(start)) {
      throw new AgendaError('INVALID_DATE', `start 格式非法（应为 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm）: ${start}`)
    }
    this.assertDate(start.slice(0, 10))
    event.allDay = allDay

    const endRaw = input.end?.trim()
    let endFull: string
    if (endRaw === undefined || endRaw === '') {
      endFull = allDay ? start : this.shiftOneHour(start)
    } else if (DATE_RE.test(endRaw)) {
      this.assertDate(endRaw)
      endFull = allDay ? endRaw : `${endRaw}T23:59`
    } else if (DATETIME_RE.test(endRaw)) {
      this.assertDate(endRaw.slice(0, 10))
      endFull = endRaw
      if (allDay) event.allDay = false // 显式给了时间 → 定时事件
    } else {
      throw new AgendaError('INVALID_DATE', `end 格式非法（应为 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm）: ${endRaw}`)
    }
    if (endFull < start) {
      throw new AgendaError('INVALID_RANGE', `结束时间早于开始时间: ${start} → ${endFull}`)
    }
    event.start = start
    event.end = endFull
    delete event.lunarYear
    delete event.lunarMonth
    delete event.lunarDay
    delete event.lunarLeap
  }

  /** 写回可选扩展字段（location/description；空串或 null 清除）。 */
  private applyEventExtras(event: AgendaEvent, input: { location?: string | null, description?: string | null }): void {
    if (input.location !== undefined) {
      const value = input.location?.trim() ?? ''
      if (value === '') delete event.location
      else event.location = value
    }
    if (input.description !== undefined) {
      const value = input.description?.trim() ?? ''
      if (value === '') delete event.description
      else event.description = value
    }
  }

  /** 提取并归一化分类字段；undefined 表示未提供，''/null 表示清除。 */
  private eventCategory(raw: string | null | undefined): string | undefined {
    if (raw === undefined || raw === null) return undefined
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    return normalizeCategoryPath(trimmed)
  }

  /** 首次引用的分类自动登记进 categories.yaml。 */
  private async registerCategoryIfNew(category: string | undefined): Promise<void> {
    if (category === undefined) return
    await this.storage.mutateCategories(categories => {
      if (!categories.includes(category)) {
        categories.push(category)
        categories.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
      }
      return { value: undefined }
    })
  }

  /** 断言日期真实存在（如 2026-02-30 会拒绝）。 */
  private assertDate(date: string): void {
    if (parseDate(date) === null) throw new AgendaError('INVALID_DATE', `日期不存在: ${date}`)
  }

  private assertTitle(title: string): void {
    if (title.trim() === '') throw new AgendaError('INVALID_TITLE', '日程标题不能为空。')
  }

  /** 取 datetime 的 HH:mm；date-only 返回 undefined。 */
  private timeOf(datetime: string): string | undefined {
    return datetime.length >= 16 ? datetime.slice(11, 16) : undefined
  }

  private shiftOneHour(datetime: string): string {
    const date = new Date(`${datetime}:00Z`)
    if (Number.isNaN(date.getTime())) {
      throw new AgendaError('INVALID_DATE', `时间格式非法: ${datetime}`)
    }
    const next = new Date(date.getTime() + 3600000)
    return `${next.toISOString().slice(0, 10)}T${next.toISOString().slice(11, 16)}`
  }

  // ── Todo ────────────────────────────────────────────────────────────────

  /** 校验重复/农历字段；返回归一化结果（农历时含换算公历日）。 */
  private prepareTodoInput(input: TodoInput): {
    recurrence?: TodoRecurrence
    calendarType: CalendarType
    lunarYear?: number
    lunarMonth?: number
    lunarDay?: number
    lunarLeap?: boolean
    /** 农历基准换算后的公历 `YYYY-MM-DD`；仅 lunar。 */
    solarDate?: string
  } {
    const recurrence = input.recurrence
    if (recurrence !== undefined
      && recurrence !== 'daily' && recurrence !== 'weekly' && recurrence !== 'monthly' && recurrence !== 'yearly') {
      throw new AgendaError('INVALID_ARGUMENT', `待办重复粒度非法: ${String(recurrence)}`)
    }
    const calendarType = input.calendarType === 'lunar' ? 'lunar' : 'solar'
    const fields: ReturnType<AgendaService['prepareTodoInput']> = { recurrence, calendarType }
    if (calendarType === 'lunar') {
      if (recurrence !== undefined && recurrence !== 'yearly') {
        throw new AgendaError('INVALID_ARGUMENT', '农历基准仅支持「每年」重复（yearly）。')
      }
      const lunarYear = input.lunarYear
      const lunarMonth = input.lunarMonth
      const lunarDay = input.lunarDay
      if (lunarYear === undefined || lunarMonth === undefined || lunarDay === undefined) {
        throw new AgendaError('INVALID_LUNAR', '农历待办需要 lunar_year / lunar_month / lunar_day。')
      }
      if (lunarYear < LUNAR_MIN_YEAR || lunarYear > LUNAR_MAX_YEAR) {
        throw new AgendaError('INVALID_LUNAR', `农历年份超出支持范围（${LUNAR_MIN_YEAR}–${LUNAR_MAX_YEAR}）: ${lunarYear}`)
      }
      if (lunarMonth < 1 || lunarMonth > 12) throw new AgendaError('INVALID_LUNAR', `农历月份非法（1–12）: ${lunarMonth}`)
      if (lunarDay < 1 || lunarDay > 30) throw new AgendaError('INVALID_LUNAR', `农历日期非法（1–30）: ${lunarDay}`)
      const solar = lunarToSolar({ lunarYear, lunarMonth, lunarDay, isLeap: input.lunarLeap === true })
      if (solar === null) {
        throw new AgendaError('INVALID_LUNAR', `农历日期不存在: ${lunarYear}年${input.lunarLeap ? '闰' : ''}${lunarMonth}月${lunarDay}日`)
      }
      fields.lunarYear = lunarYear
      fields.lunarMonth = lunarMonth
      fields.lunarDay = lunarDay
      fields.lunarLeap = input.lunarLeap === true
      fields.solarDate = solar
    }
    return fields
  }

  /** 创建待办。 */
  async createTodo(input: TodoInput): Promise<AgendaTodo> {
    const title = input.title.trim()
    if (title === '') throw new AgendaError('INVALID_TITLE', '待办标题不能为空。')
    let date = input.date.trim()
    if (!DATE_RE.test(date)) throw new AgendaError('INVALID_DATE', `待办日期非法（YYYY-MM-DD）: ${input.date}`)
    this.assertDate(date)
    const prepared = this.prepareTodoInput(input)
    if (prepared.calendarType === 'lunar' && prepared.solarDate !== undefined) date = prepared.solarDate
    const category = input.category !== undefined && input.category.trim() !== ''
      ? normalizeCategoryPath(input.category)
      : undefined
    await this.registerCategoryIfNew(category)
    const todo: AgendaTodo = {
      id: newId('t'),
      title,
      date,
      status: 'pending',
      ...this.stamp(),
      ...(prepared.recurrence !== undefined ? { recurrence: prepared.recurrence } : {}),
      ...(prepared.calendarType === 'lunar' ? {
        calendarType: prepared.calendarType,
        lunarYear: prepared.lunarYear,
        lunarMonth: prepared.lunarMonth,
        lunarDay: prepared.lunarDay,
        lunarLeap: prepared.lunarLeap,
      } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(input.description !== undefined && input.description.trim() !== '' ? { description: input.description.trim() } : {}),
    }
    await this.storage.mutateTodos(todos => {
      todos.push(todo)
      return { value: undefined }
    })
    this.dataVersion += 1
    return todo
  }

  /** 查看单个待办（模板）。 */
  async getTodo(id: string): Promise<AgendaTodo | null> {
    const todos = await this.storage.listTodos()
    return todos.find(todo => todo.id === id) ?? null
  }

  /** 列出待办模板（可选范围/状态过滤，按日期升序）。快照/编辑用；列表展示请用 listTodoInstances。 */
  async listTodos(range?: DateRange, status?: 'pending' | 'completed'): Promise<AgendaTodo[]> {
    const todos = await this.storage.listTodos()
    if (range !== undefined) this.validateRange(range)
    return todos
      .filter(todo => (range === undefined || (todo.date >= range.from && todo.date <= range.to))
        && (status === undefined || todo.status === status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  }

  /** 列出 [from,to] 内的待办实例（重复待办按规则展开）；range 省略返回全部。 */
  async listTodoInstances(range?: DateRange, status?: 'pending' | 'completed'): Promise<TodoInstance[]> {
    if (range !== undefined) {
      if (!DATE_RE.test(range.from) || !DATE_RE.test(range.to)) {
        throw new AgendaError('INVALID_DATE', `日期范围格式非法（YYYY-MM-DD）: ${range.from} → ${range.to}`)
      }
      this.assertDate(range.from)
      this.assertDate(range.to)
      if (range.to < range.from) throw new AgendaError('INVALID_RANGE', `日期范围 to 早于 from: ${range.from} → ${range.to}`)
      if (addDays(range.from, MAX_TODO_RANGE_DAYS) < range.to) {
        throw new AgendaError('RANGE_TOO_LARGE', `待办查询范围过大（上限 ${MAX_TODO_RANGE_DAYS} 天）。`)
      }
    }
    const from = range?.from ?? '0000-01-01'
    const to = range?.to ?? '9999-12-31'
    const todos = await this.storage.listTodos()
    const instances: TodoInstance[] = []
    for (const todo of todos) {
      for (const date of todoOccurrenceDates(todo, from, to)) {
        const completed = todo.recurrence !== undefined
          ? (todo.completedDates?.includes(date) ?? false)
          : todo.status === 'completed'
        if (status !== undefined && ((completed && status !== 'completed') || (!completed && status !== 'pending'))) continue
        instances.push({
          templateId: todo.id,
          date,
          title: todo.title,
          ...(todo.category !== undefined ? { category: todo.category } : {}),
          ...(todo.description !== undefined ? { description: todo.description } : {}),
          status: completed ? 'completed' : 'pending',
          ...(todo.recurrence !== undefined ? { recurrence: todo.recurrence } : {}),
        })
      }
    }
    return instances.sort((a, b) => a.date.localeCompare(b.date) || a.templateId.localeCompare(b.templateId))
  }

  /** 修改待办（模板字段 + 实例完成/重开）。 */
  async updateTodo(id: string, patch: TodoPatch): Promise<AgendaTodo> {
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new AgendaError('INVALID_TITLE', '待办标题不能为空。')
    }
    if (patch.date !== undefined) {
      const date = patch.date.trim()
      if (!DATE_RE.test(date)) throw new AgendaError('INVALID_DATE', `待办日期非法（YYYY-MM-DD）: ${patch.date}`)
      this.assertDate(date)
    }
    if (patch.status !== undefined && patch.status !== 'pending' && patch.status !== 'completed') {
      throw new AgendaError('INVALID_STATUS', `待办状态非法: ${patch.status}`)
    }
    if (patch.statusDate !== undefined) {
      if (!DATE_RE.test(patch.statusDate)) throw new AgendaError('INVALID_DATE', `实例日期非法（YYYY-MM-DD）: ${patch.statusDate}`)
      this.assertDate(patch.statusDate)
    }
    const category = patch.category !== undefined && patch.category.trim() !== ''
      ? normalizeCategoryPath(patch.category)
      : undefined
    await this.registerCategoryIfNew(category)
    const now = this.now().toISOString()
    const updated = await this.storage.mutateTodos(todos => {
      const todo = todos.find(existing => existing.id === id)
      if (todo === undefined) throw new AgendaError('NOT_FOUND', `待办不存在: ${id}`)
      if (patch.title !== undefined) todo.title = patch.title.trim()
      if (patch.date !== undefined) todo.date = patch.date.trim()

      // ── 重复 / 农历字段 ──
      if (patch.recurrence !== undefined || patch.calendarType !== undefined
        || patch.lunarYear !== undefined || patch.lunarMonth !== undefined || patch.lunarDay !== undefined || patch.lunarLeap !== undefined) {
        const prepared = this.prepareTodoInput({
          title: patch.title ?? todo.title,
          date: patch.date ?? todo.date,
          recurrence: patch.recurrence === null ? undefined : patch.recurrence,
          calendarType: patch.calendarType === null ? 'solar' : patch.calendarType,
          lunarYear: patch.lunarYear,
          lunarMonth: patch.lunarMonth,
          lunarDay: patch.lunarDay,
          lunarLeap: patch.lunarLeap,
        })
        if (patch.recurrence === null) {
          delete todo.recurrence
          delete todo.calendarType
          delete todo.lunarYear
          delete todo.lunarMonth
          delete todo.lunarDay
          delete todo.lunarLeap
          // 清除重复：模板完成状态回到 status/completedAt
          todo.status = todo.completedDates !== undefined && todo.completedDates.length > 0 ? 'completed' : 'pending'
          delete todo.completedDates
        } else {
          if (prepared.recurrence !== undefined) todo.recurrence = prepared.recurrence
          if (prepared.calendarType === 'lunar') {
            todo.calendarType = 'lunar'
            todo.lunarYear = prepared.lunarYear
            todo.lunarMonth = prepared.lunarMonth
            todo.lunarDay = prepared.lunarDay
            todo.lunarLeap = prepared.lunarLeap
            // 切农历且未显式改 date 时，用换算日覆盖
            if (patch.date === undefined && prepared.solarDate !== undefined) todo.date = prepared.solarDate
          } else {
            delete todo.calendarType
            delete todo.lunarYear
            delete todo.lunarMonth
            delete todo.lunarDay
            delete todo.lunarLeap
            // daily/weekly/monthly 或清除农历：已完成的实例保留，模板状态由 completedDates 派生
            if (todo.completedDates !== undefined && todo.completedDates.length > 0) todo.status = 'completed'
            else { todo.status = 'pending'; delete todo.completedDates }
          }
        }
      }

      if (category !== undefined) todo.category = category
      else if (patch.category !== undefined) delete todo.category
      if (patch.description !== undefined) {
        const value = patch.description.trim()
        if (value === '') delete todo.description
        else todo.description = value
      }

      // ── 完成 / 重开 ──
      if (patch.status !== undefined) {
        if (todo.recurrence === undefined) {
          // 单次待办：模板级
          if (patch.status === 'completed' && todo.status !== 'completed') todo.completedAt = now
          else if (patch.status === 'pending') delete todo.completedAt
          todo.status = patch.status
        } else if (patch.statusDate !== undefined) {
          // 重复待办：指定日期实例
          const list = new Set(todo.completedDates ?? [])
          if (patch.status === 'completed') list.add(patch.statusDate)
          else list.delete(patch.statusDate)
          todo.completedDates = [...list].sort()
          if (todo.completedDates.length === 0) delete todo.completedDates
        } else if (patch.status === 'completed') {
          // 重复待办未指定日期：完成下一个未完成实例
          const next = this.nextPendingDate(todo)
          if (next !== null) {
            todo.completedDates = [...new Set([...(todo.completedDates ?? []), next])].sort()
          }
        } else {
          // 重复待办重开（未指定日期）：清空全部实例完成
          delete todo.completedDates
        }
      }
      todo.updatedAt = now
      return { value: todo }
    })
    this.dataVersion += 1
    return updated
  }

  /** 下一个未完成的实例日期（用于无 date 的完成操作）；全部完成返回 null。 */
  private nextPendingDate(todo: AgendaTodo): string | null {
    const done = new Set(todo.completedDates ?? [])
    const to = addDays(todo.date, MAX_CALENDAR_DAYS)
    for (const date of todoOccurrenceDates(todo, todo.date, to)) {
      if (!done.has(date)) return date
    }
    return null
  }

  /** 完成 / 重新打开待办的快捷方式（可指定实例日期）。 */
  async setTodoStatus(id: string, status: 'pending' | 'completed', statusDate?: string): Promise<AgendaTodo> {
    return this.updateTodo(id, { status, statusDate })
  }

  /** 删除待办；返回被删除对象。 */
  async deleteTodo(id: string): Promise<AgendaTodo> {
    const removed = await this.storage.mutateTodos(todos => {
      const index = todos.findIndex(todo => todo.id === id)
      if (index === -1) throw new AgendaError('NOT_FOUND', `待办不存在: ${id}`)
      const [todo] = todos.splice(index, 1)
      return { value: todo }
    })
    this.dataVersion += 1
    return removed
  }

  // ── 分类管理 ────────────────────────────────────────────────────────────

  async listCategories(): Promise<string[]> {
    return this.storage.listCategories()
  }

  /** 新增分类（已存在则原样返回）。 */
  async createCategory(path: string): Promise<string[]> {
    const normalized = normalizeCategoryPath(path)
    await this.storage.mutateCategories(categories => {
      if (!categories.includes(normalized)) {
        categories.push(normalized)
        categories.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
      }
      return { value: undefined }
    })
    this.dataVersion += 1
    return this.storage.listCategories()
  }

  /** 删除分类（Event/Todo 上的引用保留为文本）。 */
  async deleteCategory(path: string): Promise<string[]> {
    const normalized = normalizeCategoryPath(path)
    await this.storage.mutateCategories(categories => {
      const index = categories.indexOf(normalized)
      if (index !== -1) categories.splice(index, 1)
      return { value: undefined }
    })
    this.dataVersion += 1
    return this.storage.listCategories()
  }

  // ── 日历信息 ────────────────────────────────────────────────────────────

  /** 计算日期区间的 DayInfo（公历+农历+节假日）。 */
  async calendarInfo(from: string, to: string): Promise<DayInfo[]> {
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new AgendaError('INVALID_DATE', 'calendar-info 需要 from/to 为 YYYY-MM-DD。')
    }
    this.assertDate(from)
    this.assertDate(to)
    if (to < from) throw new AgendaError('INVALID_RANGE', `to 早于 from: ${from} → ${to}`)
    const days: DayInfo[] = []
    let cursor = from
    let guard = 0
    const today = todayISO(this.now())
    while (cursor <= to && guard < MAX_CALENDAR_DAYS) {
      const utc = new Date(`${cursor}T00:00:00Z`)
      // 周一=1 … 周日=7
      const weekday = ((utc.getUTCDay() + 6) % 7) + 1
      const lunar = solarToLunar(cursor)
      const kind = await this.holidays.dayKind(cursor, weekday)
      const dayInfo: DayInfo = {
        date: cursor,
        weekday,
        lunarText: lunar !== null ? lunarCellText(lunar) : '',
        lunarYear: lunar?.lunarYear ?? 0,
        lunarLeap: lunar?.isLeap ?? false,
        dayType: kind.type,
        isToday: cursor === today,
      }
      if (kind.holidayName !== undefined) dayInfo.holidayName = kind.holidayName
      const festival = lunar !== null ? lunarFestivalOf(lunar) : null
      if (festival !== null) dayInfo.festival = festival
      else if (isLunarNewYearEve(cursor)) dayInfo.festival = '除夕'
      days.push(dayInfo)
      cursor = nextDay(cursor)
      guard += 1
    }
    if (guard >= MAX_CALENDAR_DAYS && cursor <= to) {
      throw new AgendaError('RANGE_TOO_LARGE', `日期区间过大（上限 ${MAX_CALENDAR_DAYS} 天）。`)
    }
    return days
  }

  // ── 统计 ────────────────────────────────────────────────────────────────

  /** 范围统计（需求 §10）。 */
  async statistics(range: DateRange): Promise<StatisticsResult> {
    this.validateRange(range)
    const [events, todoInstances] = await Promise.all([
      this.listEvents(range),
      this.listTodoInstances(range),
    ])
    const byCategory = new Map<string, { eventCount: number, todoCount: number, eventHours: number }>()
    const bump = (category: string, fields: Partial<{ eventCount: number, todoCount: number, eventHours: number }>): void => {
      const row = byCategory.get(category) ?? { eventCount: 0, todoCount: 0, eventHours: 0 }
      if (fields.eventCount !== undefined) row.eventCount += fields.eventCount
      if (fields.todoCount !== undefined) row.todoCount += fields.todoCount
      if (fields.eventHours !== undefined) row.eventHours += fields.eventHours
      byCategory.set(category, row)
    }
    let eventCount = 0
    let allDayEventCount = 0
    let eventHours = 0
    for (const event of events) {
      eventCount += 1
      if (event.allDay) {
        allDayEventCount += 1
        bump(event.category ?? '未分类', { eventCount: 1 })
        continue
      }
      const hours = this.eventDurationHours(event)
      eventHours += hours
      bump(event.category ?? '未分类', { eventCount: 1, eventHours: hours })
    }
    let todoCount = 0
    let todoCompleted = 0
    for (const instance of todoInstances) {
      todoCount += 1
      if (instance.status === 'completed') todoCompleted += 1
      bump(instance.category ?? '未分类', { todoCount: 1 })
    }
    return {
      range,
      eventCount,
      allDayEventCount,
      todoCount,
      todoCompleted,
      todoPending: todoCount - todoCompleted,
      todoCompletionRate: todoCount === 0 ? 0 : todoCompleted / todoCount,
      eventHours: Math.round(eventHours * 100) / 100,
      byCategory: [...byCategory.entries()]
        .map(([category, row]) => ({ category, ...row }))
        .sort((a, b) => (b.eventCount + b.todoCount) - (a.eventCount + a.todoCount)),
    }
  }

  /** 定时事件时长（小时）；跨天按自然跨度。 */
  private eventDurationHours(event: AgendaEvent): number {
    if (event.allDay) return 0
    const start = new Date(`${event.start}:00Z`).getTime()
    const end = new Date(`${event.end}:00Z`).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
    return (end - start) / 3600000
  }

  // ── 搜索 ────────────────────────────────────────────────────────────────

  /**
   * 联合搜索（需求 §11）：Event 的 title/description/category 与
   * Todo 的 title/category；可选日期范围过滤。
   */
  async search(query: string, options?: { eventsRange?: DateRange, todosRange?: DateRange }): Promise<SearchResult> {
    const needle = query.trim().toLowerCase()
    if (needle === '') throw new AgendaError('INVALID_ARGUMENT', '搜索词不能为空。')
    const events = await this.storage.listEvents()
    const todos = await this.storage.listTodos()
    const match = (...fields: Array<string | undefined>): boolean =>
      fields.some(field => field !== undefined && field.toLowerCase().includes(needle))
    const eventHits = events
      .filter(event => match(event.title, event.description, event.category))
      .filter(event => {
        const range = options?.eventsRange
        if (range === undefined) return true
        return eventDates(event).some(date => date >= range.from && date <= range.to)
      })
      .sort((a, b) => b.start.localeCompare(a.start))
    const todoHits = todos
      .filter(todo => match(todo.title, todo.category))
      .filter(todo => {
        const range = options?.todosRange
        if (range === undefined) return true
        return todoOccurrenceDates(todo, range.from, range.to).length > 0
      })
      .sort((a, b) => b.date.localeCompare(a.date))
    const eventTotal = eventHits.length
    const todoTotal = todoHits.length
    return {
      events: eventHits.slice(0, SEARCH_LIMIT),
      todos: todoHits.slice(0, SEARCH_LIMIT),
      eventTotal,
      todoTotal,
      truncated: eventTotal > SEARCH_LIMIT || todoTotal > SEARCH_LIMIT,
    }
  }

  // ─── 内部工具 ────────────────────────────────────────────────────────────

  private validateRange(range: DateRange): void {
    if (!DATE_RE.test(range.from) || !DATE_RE.test(range.to)) {
      throw new AgendaError('INVALID_DATE', `日期范围格式非法（YYYY-MM-DD）: ${range.from} → ${range.to}`)
    }
    this.assertDate(range.from)
    this.assertDate(range.to)
    if (range.to < range.from) {
      throw new AgendaError('INVALID_RANGE', `日期范围 to 早于 from: ${range.from} → ${range.to}`)
    }
    if (addDays(range.from, MAX_CALENDAR_DAYS) < range.to) {
      throw new AgendaError('RANGE_TOO_LARGE', `日期范围过大（上限 ${MAX_CALENDAR_DAYS} 天）。`)
    }
  }
}
