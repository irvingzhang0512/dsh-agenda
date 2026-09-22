/**
 * dsh-agenda — CsvAgendaStorage：AgendaStorage 的 CSV/YAML 本地文件实现。
 *
 * 目录布局（需求 §14）：
 *
 *   <dataDir>/events.csv
 *   <dataDir>/todos.csv
 *   <dataDir>/categories.yaml
 *   <dataDir>/settings.yaml
 *   <dataDir>/holidays/<year>.yaml
 *   <dataDir>/backup/<file>.<stamp>.bak
 *
 * CSV 列序固定（见 EVENTS_COLUMNS / TODOS_COLUMNS）；新增列只能追加在尾部，
 * 解析端按列名取值，容忍列序调整与多余列。写路径统一走 withLockedFile
 * （文件锁 + .tmp + 原子替换 + 自动备份）。
 */
import yaml from 'js-yaml'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgendaEvent, AgendaSettings, AgendaTodo, CalendarType, TodoStatus } from '../shared/types.ts'
import { atomicWriteFile, withLockedFile, type AtomicWriteOptions } from './file-lock.ts'
import { parseCsv, stringifyCsv } from './csv.ts'
import type { AgendaStorage, HolidayYear } from './storage.ts'

/** events.csv 的列序（权威顺序；解析按表头名映射）。 */
const EVENTS_COLUMNS = [
  'id', 'title', 'start', 'end', 'all_day', 'calendar_type',
  'lunar_year', 'lunar_month', 'lunar_day', 'lunar_leap',
  'category', 'location', 'description', 'recurrence', 'created_at', 'updated_at',
] as const

/** todos.csv 的列序。 */
const TODOS_COLUMNS = [
  'id', 'title', 'date', 'status', 'category', 'description', 'completed_at', 'created_at', 'updated_at',
] as const

/** 每个文件保留的备份数。 */
const KEEP_BACKUPS = 10

/** CSV 行 → 领域对象的中间层（缺列时值为 undefined）。 */
function rowToRecord(header: readonly string[], row: readonly string[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (let i = 0; i < header.length; i += 1) record[header[i] as string] = row[i] ?? ''
  return record
}

/** 可选字符串字段：空串归一化为 undefined。 */
function optional(value: string | undefined): string | undefined {
  const text = (value ?? '').trim()
  return text === '' ? undefined : text
}

/** 布尔字段。 */
function boolOf(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

/** 可选数字字段。 */
function numberOrUndefined(value: string | undefined): number | undefined {
  const text = (value ?? '').trim()
  if (text === '') return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

// ─── Event 行映射 ────────────────────────────────────────────────────────

function eventToRow(event: AgendaEvent): string[] {
  return [
    event.id,
    event.title,
    event.start,
    event.end,
    event.allDay ? 'true' : 'false',
    event.calendarType,
    event.lunarYear !== undefined ? String(event.lunarYear) : '',
    event.lunarMonth !== undefined ? String(event.lunarMonth) : '',
    event.lunarDay !== undefined ? String(event.lunarDay) : '',
    event.lunarLeap === true ? 'true' : '',
    event.category ?? '',
    event.location ?? '',
    event.description ?? '',
    event.recurrence,
    event.createdAt,
    event.updatedAt,
  ]
}

function rowToEvent(record: Record<string, string>): AgendaEvent | null {
  const id = optional(record.id)
  const title = optional(record.title)
  const start = optional(record.start)
  const end = optional(record.end)
  if (id === undefined || title === undefined || start === undefined || end === undefined) return null
  const calendarType: CalendarType = record.calendar_type === 'lunar' ? 'lunar' : 'solar'
  const event: AgendaEvent = {
    id,
    title,
    start,
    end,
    allDay: boolOf(record.all_day),
    calendarType,
    recurrence: optional(record.recurrence) ?? 'none',
    createdAt: optional(record.created_at) ?? new Date().toISOString(),
    updatedAt: optional(record.updated_at) ?? new Date().toISOString(),
  }
  if (calendarType === 'lunar') {
    const lunarYear = numberOrUndefined(record.lunar_year)
    const lunarMonth = numberOrUndefined(record.lunar_month)
    const lunarDay = numberOrUndefined(record.lunar_day)
    if (lunarYear !== undefined && lunarMonth !== undefined && lunarDay !== undefined) {
      event.lunarYear = lunarYear
      event.lunarMonth = lunarMonth
      event.lunarDay = lunarDay
      event.lunarLeap = boolOf(record.lunar_leap)
    }
  }
  const category = optional(record.category)
  if (category !== undefined) event.category = category
  const location = optional(record.location)
  if (location !== undefined) event.location = location
  const description = optional(record.description)
  if (description !== undefined) event.description = description
  return event
}

function serializeEvents(events: AgendaEvent[]): string {
  return stringifyCsv([[...EVENTS_COLUMNS], ...events.map(eventToRow)])
}

function parseEvents(text: string | null): AgendaEvent[] {
  if (text === null || text.trim() === '') return []
  const rows = parseCsv(text)
  if (rows.length <= 1) return []
  const header = rows[0] as string[]
  const events: AgendaEvent[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const event = rowToEvent(rowToRecord(header, rows[i] as string[]))
    if (event !== null) events.push(event)
  }
  return events
}

// ─── Todo 行映射 ─────────────────────────────────────────────────────────

function todoToRow(todo: AgendaTodo): string[] {
  return [
    todo.id,
    todo.title,
    todo.date,
    todo.status,
    todo.category ?? '',
    todo.description ?? '',
    todo.completedAt ?? '',
    todo.createdAt,
    todo.updatedAt,
  ]
}

function rowToTodo(record: Record<string, string>): AgendaTodo | null {
  const id = optional(record.id)
  const title = optional(record.title)
  const date = optional(record.date)
  if (id === undefined || title === undefined || date === undefined) return null
  const status: TodoStatus = record.status === 'completed' ? 'completed' : 'pending'
  const todo: AgendaTodo = {
    id,
    title,
    date,
    status,
    createdAt: optional(record.created_at) ?? new Date().toISOString(),
    updatedAt: optional(record.updated_at) ?? new Date().toISOString(),
  }
  const category = optional(record.category)
  if (category !== undefined) todo.category = category
  const description = optional(record.description)
  if (description !== undefined) todo.description = description
  const completedAt = optional(record.completed_at)
  if (status === 'completed' && completedAt !== undefined) todo.completedAt = completedAt
  return todo
}

function serializeTodos(todos: AgendaTodo[]): string {
  return stringifyCsv([[...TODOS_COLUMNS], ...todos.map(todoToRow)])
}

function parseTodos(text: string | null): AgendaTodo[] {
  if (text === null || text.trim() === '') return []
  const rows = parseCsv(text)
  if (rows.length <= 1) return []
  const header = rows[0] as string[]
  const todos: AgendaTodo[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const todo = rowToTodo(rowToRecord(header, rows[i] as string[]))
    if (todo !== null) todos.push(todo)
  }
  return todos
}

// ─── YAML 辅助 ───────────────────────────────────────────────────────────

/** 读 YAML 文件；不存在或解析失败返回 null。 */
async function readYaml<T>(path: string): Promise<T | null> {
  const text = await readFile(path, 'utf8').catch(() => null)
  if (text === null || text.trim() === '') return null
  try {
    return yaml.load(text) as T
  } catch {
    return null
  }
}

function parseHolidayYear(data: unknown, year: number): HolidayYear | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const holidays: Array<{ name: string, dates: string[] }> = []
  if (Array.isArray(record.holidays)) {
    for (const item of record.holidays) {
      if (typeof item !== 'object' || item === null) continue
      const entry = item as Record<string, unknown>
      const name = typeof entry.name === 'string' ? entry.name : ''
      const dates = Array.isArray(entry.dates) ? entry.dates.filter((d): d is string => typeof d === 'string') : []
      if (name !== '' && dates.length > 0) holidays.push({ name, dates })
    }
  }
  const workdays = Array.isArray(record.workdays)
    ? record.workdays.filter((d): d is string => typeof d === 'string')
    : []
  return { year, holidays, workdays }
}

// ─── 实现 ────────────────────────────────────────────────────────────────

/**
 * CSV/YAML 本地文件存储。
 */
export class CsvAgendaStorage implements AgendaStorage {
  readonly dataDir: string
  private readonly backupDir: string
  private readonly writeOptions: AtomicWriteOptions

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.backupDir = join(dataDir, 'backup')
    this.writeOptions = { backupDir: this.backupDir, keepBackups: KEEP_BACKUPS }
  }

  private get eventsPath(): string { return join(this.dataDir, 'events.csv') }
  private get todosPath(): string { return join(this.dataDir, 'todos.csv') }
  private get categoriesPath(): string { return join(this.dataDir, 'categories.yaml') }
  private get settingsPath(): string { return join(this.dataDir, 'settings.yaml') }
  private holidayPath(year: number): string { return join(this.dataDir, 'holidays', `${year}.yaml`) }

  /** 确保目录结构存在（挂载时调用一次）。 */
  async ensureLayout(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true })
    await mkdir(join(this.dataDir, 'holidays'), { recursive: true })
    await mkdir(this.backupDir, { recursive: true })
  }

  // ── Event ──

  async listEvents(): Promise<AgendaEvent[]> {
    const text = await readFile(this.eventsPath, 'utf8').catch(() => null)
    return parseEvents(text)
  }

  async mutateEvents<T>(mutate: (events: AgendaEvent[]) => { value: T }): Promise<T> {
    return withLockedFile(this.eventsPath, this.writeOptions, current => {
      const events = parseEvents(current)
      const outcome = mutate(events)
      return { value: outcome.value, content: serializeEvents(events) }
    })
  }

  // ── Todo ──

  async listTodos(): Promise<AgendaTodo[]> {
    const text = await readFile(this.todosPath, 'utf8').catch(() => null)
    return parseTodos(text)
  }

  async mutateTodos<T>(mutate: (todos: AgendaTodo[]) => { value: T }): Promise<T> {
    return withLockedFile(this.todosPath, this.writeOptions, current => {
      const todos = parseTodos(current)
      const outcome = mutate(todos)
      return { value: outcome.value, content: serializeTodos(todos) }
    })
  }

  // ── 分类 ──

  async listCategories(): Promise<string[]> {
    const data = await readYaml<{ categories?: unknown }>(this.categoriesPath)
    if (data === null || !Array.isArray(data.categories)) return []
    return data.categories.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
  }

  async mutateCategories<T>(mutate: (categories: string[]) => { value: T }): Promise<T> {
    return withLockedFile(this.categoriesPath, this.writeOptions, current => {
      let categories: string[]
      if (current === null || current.trim() === '') {
        categories = []
      } else {
        try {
          const data = yaml.load(current) as { categories?: unknown } | undefined
          categories = Array.isArray(data?.categories)
            ? (data.categories as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim() !== '')
            : []
        } catch {
          categories = []
        }
      }
      const outcome = mutate(categories)
      const content = yaml.dump({ categories }, { lineWidth: 120 })
      return { value: outcome.value, content }
    })
  }

  // ── 设置 ──

  async loadSettings(): Promise<AgendaSettings | null> {
    const data = await readYaml<{ weekStart?: unknown }>(this.settingsPath)
    if (data === null) return null
    return {
      weekStart: data.weekStart === 'sunday' ? 'sunday' : 'monday',
    }
  }

  async saveSettings(settings: AgendaSettings): Promise<void> {
    await atomicWriteFile(this.settingsPath, yaml.dump(
      { weekStart: settings.weekStart },
      { lineWidth: 120 },
    ), this.writeOptions)
  }

  // ── 节假日 ──

  async listHolidayYears(): Promise<number[]> {
    const dir = join(this.dataDir, 'holidays')
    const entries = await readdir(dir).catch(() => [] as string[])
    const years: number[] = []
    for (const entry of entries) {
      const match = /^(\d{4})\.ya?ml$/.exec(entry)
      if (match !== null) years.push(Number(match[1]))
    }
    return years.sort((a, b) => a - b)
  }

  async readHolidayYear(year: number): Promise<HolidayYear | null> {
    const data = await readYaml<unknown>(this.holidayPath(year))
    if (data === null) return null
    return parseHolidayYear(data, year)
  }

  async writeHolidayYear(data: HolidayYear): Promise<void> {
    const content = yaml.dump({
      year: data.year,
      holidays: data.holidays.map(holiday => ({ name: holiday.name, dates: holiday.dates })),
      workdays: data.workdays,
    }, { lineWidth: 120 })
    await atomicWriteFile(this.holidayPath(data.year), content, this.writeOptions)
  }

  /** 调试用：直接写一个文本文件（seed 脚本/测试使用）。 */
  async writeRaw(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf8')
  }
}
