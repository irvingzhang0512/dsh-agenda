/**
 * dsh-agenda — 存储接口（AgendaStorage）与节假日文件数据。
 *
 * 业务层（Service / Tool / UI）只面向本接口与领域对象，不接触 CSV/YAML；
 * 当前实现为 CsvAgendaStorage，未来可替换为 JSONL / SQLite / Remote 而不
 * 影响 UI / Service / Tool（需求 §15）。
 *
 * 变更语义：mutate* 系列在文件锁内执行「读取最新 → 变更 → 原子替换」，
 * 调用方直接原地修改数组并返回需要的结果即可。
 */
import type { AgendaEvent, AgendaSettings, AgendaTodo } from '../shared/types.ts'

/** 一年的节假日数据（holidays/&lt;year&gt;.yaml）。 */
export interface HolidayYear {
  year: number
  /** 法定节假日段（名称 + 具体日期）。 */
  holidays: Array<{ name: string, dates: string[] }>
  /** 调休上班日。 */
  workdays: string[]
}

/** AgendaStorage 统一存储接口。 */
export interface AgendaStorage {
  /** 存储根目录（诊断 / 备份说明用）。 */
  readonly dataDir: string

  // ── Event ──
  listEvents(): Promise<AgendaEvent[]>
  /** 在锁内读取最新事件列表，交由 mutate 原地修改；抛错不落盘。 */
  mutateEvents<T>(mutate: (events: AgendaEvent[]) => { value: T }): Promise<T>

  // ── Todo ──
  listTodos(): Promise<AgendaTodo[]>
  mutateTodos<T>(mutate: (todos: AgendaTodo[]) => { value: T }): Promise<T>

  // ── 分类 ──
  listCategories(): Promise<string[]>
  mutateCategories<T>(mutate: (categories: string[]) => { value: T }): Promise<T>

  // ── 设置 ──
  loadSettings(): Promise<AgendaSettings | null>
  saveSettings(settings: AgendaSettings): Promise<void>

  // ── 节假日 ──
  /** 已存在的节假日数据年份（升序）。 */
  listHolidayYears(): Promise<number[]>
  readHolidayYear(year: number): Promise<HolidayYear | null>
  writeHolidayYear(data: HolidayYear): Promise<void>
}
