/**
 * dsh-agenda — 农历转换（LunarService 的纯函数核心）。
 *
 * 数据表与边界行为源自社区广泛验证的 calendar.js 数据（1900–2100，
 * 每年一个 bit 位压缩值），算法在本仓库内以 TypeScript 重新实现：
 *
 * - bit 0–3  ：闰月月份（0 = 当年无闰月）
 * - bit 4–15 ：十二月的大小月标志（bit4=腊月 … bit15=正月；置位为 30 天）
 * - bit 16   ：闰月为大月（30 天）
 *
 * 纪元锚点：1900-01-31（UTC）= 农历 1900 年正月初一。所有日期运算
 * 使用 UTC 日历日，避免宿主时区/夏令时干扰。支持范围 1900-01-31 至
 * 2099-12-31（2100 年仅支持到其农历腊月内的一部分，与参考实现一致，
 * 本模块显式限制在 2099 冬季之前，超出即返回 null）。
 */
/** 农历表的最早/最晚年。 */
export declare const LUNAR_MIN_YEAR = 1900;
export declare const LUNAR_MAX_YEAR = 2099;
/** 农历日期（lunar year 与 isLeap 是一等公民，跨年无损）。 */
export interface LunarDate {
    lunarYear: number;
    /** 1–12。 */
    lunarMonth: number;
    /** 1–30。 */
    lunarDay: number;
    /** 该月是否闰月。 */
    isLeap: boolean;
}
/** 农历年闰月月份；0 = 无闰月。 */
export declare function leapMonthOf(lunarYear: number): number;
/** 农历年闰月天数；无闰月为 0。 */
export declare function leapDaysOf(lunarYear: number): number;
/** 农历普通月（非闰月）天数；月份非法返回 null。 */
export declare function monthDaysOf(lunarYear: number, lunarMonth: number): number | null;
/** 农历年总天数（含闰月）。 */
export declare function lunarYearDays(lunarYear: number): number;
/** 农历年正月初一的公历 `YYYY-MM-DD`；越界返回 null。 */
export declare function lunarNewYearDay(lunarYear: number): string | null;
/** 农历日数字 → 汉字（初一、初十、十五、二十、廿三、三十…）。 */
export declare function chineseDay(lunarDay: number): string;
/** 农历月数字 → 月名（正月、八月、腊月…）。 */
export declare function chineseMonth(lunarMonth: number, isLeap: boolean): string;
/** 日历格里展示的农历短文本：初一显示月名（如「八月」），否则显示日名（如「十五」）。 */
export declare function lunarCellText(lunar: LunarDate): string;
/** 公历 `YYYY-MM-DD` → 农历；范围外或非法返回 null。 */
export declare function solarToLunar(date: string): LunarDate | null;
/** 农历（年/月/日/是否闰月）→ 公历 `YYYY-MM-DD`；非法组合返回 null。 */
export declare function lunarToSolar(lunar: LunarDate): string | null;
/** 农历日期对应的传统节日名；无返回 null。除夕单独判断（次日是正月初一）。 */
export declare function lunarFestivalOf(lunar: LunarDate): string | null;
/** 某公历日是否除夕（次日为正月初一）。 */
export declare function isLunarNewYearEve(date: string): boolean;
/** 次日 `YYYY-MM-DD`。 */
export declare function nextDay(date: string): string;
