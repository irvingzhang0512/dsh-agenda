/** 年度数据规范化与覆盖归并；无 Node／浏览器依赖。 */
import { parseDate } from "../shared/types.js";
import { AgendaError } from "./errors.js";
export function holidayName(name) {
    return { 清明: '清明节', 端午: '端午节', 中秋: '中秋节' }[name.trim()] ?? name.trim();
}
export function normalizeHolidayYear(raw, year) {
    const fail = (reason) => { throw new AgendaError('INVALID_HOLIDAY_DATA', `${year} 年放假资料无效：${reason}。`); };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return fail('年度资料须为对象');
    const r = raw;
    if (r.year !== undefined && r.year !== year)
        return fail('资料年份与文件名不符');
    if (!Array.isArray(r.holidays) || !Array.isArray(r.workdays))
        return fail('holidays 与 workdays 须为数组');
    const days = new Map();
    const work = new Set();
    const valid = (date) => typeof date === 'string' && parseDate(date) !== null && Number(date.slice(0, 4)) === year;
    for (const h of r.holidays) {
        if (!h || typeof h !== 'object' || typeof h.name !== 'string' || !h.name.trim() || !Array.isArray(h.dates))
            return fail('节日名称须为非空文字且 dates 须为数组');
        const name = holidayName(h.name);
        for (const d of h.dates) {
            if (!valid(d))
                return fail('节日日期不存在或不属于该年');
            if (days.has(d) && days.get(d) !== name)
                return fail('同一天出现不同节日名称');
            days.set(d, name);
        }
    }
    for (const d of r.workdays) {
        if (!valid(d))
            return fail('调休日期不存在或不属于该年');
        if (days.has(d))
            return fail('同一天同时标为放假和调休上班');
        work.add(d);
    }
    return fromDays(year, new Map([...days].map(([d, n]) => [d, `holiday:${n}`])), work);
}
function fromDays(year, days, work = new Set()) {
    const names = new Map();
    for (const [date, kind] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
        if (kind === 'work') {
            work.add(date);
            continue;
        }
        const name = kind.slice(8);
        const list = names.get(name) ?? [];
        list.push(date);
        names.set(name, list);
    }
    return { year, holidays: [...names].map(([name, dates]) => ({ name, dates })), workdays: [...work].sort() };
}
function dayMap(data) {
    const map = new Map();
    for (const h of data.holidays)
        for (const d of h.dates)
            map.set(d, `holiday:${holidayName(h.name)}`);
    for (const d of data.workdays)
        map.set(d, 'work');
    return map;
}
export function mergeHolidayYear(base, local, legacy) {
    if (!local)
        return { data: base, overridden: false, legacyFull: false };
    if (!legacy || !base)
        return { data: local, overridden: true, legacyFull: true };
    const previous = dayMap(legacy), custom = dayMap(local), effective = dayMap(base);
    let overridden = false;
    for (const date of new Set([...previous.keys(), ...custom.keys()])) {
        if (previous.get(date) === custom.get(date))
            continue;
        overridden = true;
        const value = custom.get(date);
        if (value === undefined)
            effective.delete(date);
        else
            effective.set(date, value);
    }
    return { data: fromDays(base.year, effective), overridden, legacyFull: false };
}
