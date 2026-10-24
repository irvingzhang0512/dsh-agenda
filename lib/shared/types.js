/**
 * dsh-agenda — 共享领域类型与线协议。
 *
 * 本文件被 host 半（Node）与 client 半（浏览器）同时引用，必须保持：
 * - 零运行时依赖（只允许纯函数与类型）；
 * - 只使用 JSON 可序列化的结构（WebSocket 线协议直接承载这些类型）。
 */
// ─── 日期纯函数（host/client 共用，UTC 基准避免时区问题）────────────────
/** 日期正则：YYYY-MM-DD。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 日期时间正则：YYYY-MM-DDTHH:mm。 */
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** 时间正则：HH:mm。 */
export const TIME_RE = /^\d{2}:\d{2}$/;
/** 把 `YYYY-MM-DD` 解析为 UTC 零点的 Date；非法返回 null。 */
export function parseDate(date) {
    if (!DATE_RE.test(date))
        return null;
    const [y, m, d] = date.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d)
        return null;
    return utc;
}
/** Date → `YYYY-MM-DD`（UTC 基准）。 */
export function formatDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/** 天数差：target - base（按 UTC 日历日）。 */
export function diffDays(base, target) {
    const b = parseDate(base);
    const t = parseDate(target);
    if (b === null || t === null)
        return 0;
    return Math.round((t.getTime() - b.getTime()) / 86400000);
}
/** 基准日 + n 天 → `YYYY-MM-DD`。 */
export function addDays(date, days) {
    const base = parseDate(date);
    if (base === null)
        return date;
    return formatDate(new Date(base.getTime() + days * 86400000));
}
/** 事件占用的日期闭区间（跨天事件展开为逐日）。
 * 定时事件结束于次日 00:00 时视为只占用开始日（20:00-24:00 不占第二天）。 */
export function eventDates(event) {
    const startDay = event.start.slice(0, 10);
    let endDay = event.end.slice(0, 10);
    if (!event.allDay && event.end.length >= 16 && event.end.endsWith('T00:00') && endDay > startDay) {
        endDay = addDays(endDay, -1);
    }
    if (endDay < startDay)
        endDay = startDay;
    const days = [];
    let cursor = startDay;
    let guard = 0;
    while (cursor <= endDay && guard < 370) {
        days.push(cursor);
        cursor = addDays(cursor, 1);
        guard += 1;
    }
    return days;
}
/** 事件是否覆盖某一天。 */
export function eventOverlapsDate(event, date) {
    const days = eventDates(event);
    return days.length === 1 ? days[0] === date : days.includes(date);
}
/** 今天（本地时区）的 `YYYY-MM-DD`。 */
export function todayISO(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
