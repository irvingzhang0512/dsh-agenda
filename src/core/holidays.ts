/**
 * dsh-agenda — HolidayService：法定节假日 / 调休工作日。
 *
 * 数据来源 `<dataDir>/holidays/<year>.yaml`（需求 §8）：
 *
 *   year: 2026
 *   holidays:
 *     - name: 春节
 *       dates: ['2026-02-15', ..., '2026-02-23']
 *   workdays:            # 调休上班日
 *     - '2026-02-14'
 *
 * 判定优先级：调休上班（班）> 法定节假日（休，带名称）> 周末 > 正常工作日。
 * 年数据带 60s 缓存；写入后立即失效。
 */
import type { DayType } from '../shared/types.ts'
import type { AgendaStorage, HolidayYear } from '../storage/storage.ts'

/** 缓存 TTL：节假日数据极少变化。 */
const CACHE_TTL_MS = 60_000

/** 一天的人类可读判定结果。 */
export interface DayKind {
  type: DayType
  /** 节假日名称（仅 type='holiday'）。 */
  holidayName?: string
}

export class HolidayService {
  private readonly storage: AgendaStorage
  private readonly cache = new Map<number, { loadedAt: number, data: HolidayYear | null }>()

  constructor(storage: AgendaStorage) {
    this.storage = storage
  }

  /** 读取某年数据（带缓存）。 */
  async loadYear(year: number): Promise<HolidayYear | null> {
    const cached = this.cache.get(year)
    if (cached !== undefined && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.data
    const data = await this.storage.readHolidayYear(year)
    this.cache.set(year, { loadedAt: Date.now(), data })
    return data
  }

  /** 写入某年数据并失效缓存。 */
  async writeYear(data: HolidayYear): Promise<void> {
    await this.storage.writeHolidayYear(data)
    this.cache.delete(data.year)
  }

  /** 已有数据的年份列表（用于 UI 提示 / seed 检查）。 */
  async availableYears(): Promise<number[]> {
    return this.storage.listHolidayYears()
  }

  /**
   * 判定某天的类型。
   * @param date `YYYY-MM-DD`
   * @param weekday 1=周一 … 7=周日
   */
  async dayKind(date: string, weekday: number): Promise<DayKind> {
    const year = Number(date.slice(0, 4))
    const data = await this.loadYear(Number.isFinite(year) ? year : 0)
    if (data !== null) {
      if (data.workdays.includes(date)) return { type: 'adjusted-workday' }
      for (const holiday of data.holidays) {
        if (holiday.dates.includes(date)) {
          return { type: 'holiday', holidayName: holiday.name }
        }
      }
    }
    if (weekday === 6 || weekday === 7) return { type: 'weekend' }
    return { type: 'workday' }
  }
}
