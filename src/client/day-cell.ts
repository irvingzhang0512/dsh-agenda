/**
 * dsh-agenda — 日期格底色与农历位展示的共享规则（月视图与周视图列头共用）。
 *
 * 底色体系（MIUI/钉钉式）：周末灰 / 法定节假日红 / 调休蓝；今天由视图额外叠加
 * da-today-cell（该类在 CSS 中定义于三个底色类之后，同优先级下优先生效）。
 * 农历位文本优先级：法定节假日名（红）> 传统节日名（橙）> 农历文本（灰）。
 */
import type { DayInfo } from '../shared/types.ts'

/** 日期格底色类名；普通工作日返回空串。 */
export function cellBgClass(day: DayInfo): string {
  if (day.dayType === 'weekend') return 'da-weekend-cell'
  if (day.dayType === 'holiday') return 'da-holiday-cell'
  if (day.dayType === 'adjusted-workday') return 'da-adjusted-cell'
  return ''
}

/** 农历位高亮文本；当天无节日时返回 null（视图回退显示 lunarText）。 */
export function lunarAccentOf(day: DayInfo): { text: string, cls: string } | null {
  if (day.holidayName !== undefined && day.holidayName !== '') return { text: day.holidayName, cls: 'da-lunar-holiday' }
  if (day.festival !== undefined && day.festival !== '') return { text: day.festival, cls: 'da-lunar-festival' }
  return null
}
