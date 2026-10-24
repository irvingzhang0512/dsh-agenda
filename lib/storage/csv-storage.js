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
import yaml from 'js-yaml';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AgendaError } from "../core/errors.js";
import { normalizeHolidayYear } from "../core/holiday-data.js";
import { DATE_RE } from "../shared/types.js";
import { atomicWriteFile, withLockedFile } from "./file-lock.js";
import { parseCsv, stringifyCsv } from "./csv.js";
/** events.csv 的列序（权威顺序；解析按表头名映射）。 */
const EVENTS_COLUMNS = [
    'id', 'title', 'start', 'end', 'all_day', 'calendar_type',
    'lunar_year', 'lunar_month', 'lunar_day', 'lunar_leap',
    'category', 'location', 'description', 'recurrence', 'created_at', 'updated_at',
];
/** todos.csv 的列序。 */
const TODOS_COLUMNS = [
    'id', 'title', 'date', 'status', 'category', 'description', 'completed_at', 'created_at', 'updated_at',
    'calendar_type', 'lunar_year', 'lunar_month', 'lunar_day', 'lunar_leap', 'recurrence', 'completed_dates',
];
/** 每个文件保留的备份数。 */
const KEEP_BACKUPS = 10;
/** CSV 行 → 领域对象的中间层（缺列时值为 undefined）。 */
function rowToRecord(header, row) {
    const record = {};
    for (let i = 0; i < header.length; i += 1)
        record[header[i]] = row[i] ?? '';
    return record;
}
/** 可选字符串字段：空串归一化为 undefined。 */
function optional(value) {
    const text = (value ?? '').trim();
    return text === '' ? undefined : text;
}
/** 布尔字段。 */
function boolOf(value) {
    return value === 'true' || value === '1';
}
/** 可选数字字段。 */
function numberOrUndefined(value) {
    const text = (value ?? '').trim();
    if (text === '')
        return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
}
// ─── Event 行映射 ────────────────────────────────────────────────────────
function eventToRow(event) {
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
    ];
}
function rowToEvent(record) {
    const id = optional(record.id);
    const title = optional(record.title);
    const start = optional(record.start);
    const end = optional(record.end);
    if (id === undefined || title === undefined || start === undefined || end === undefined)
        return null;
    const calendarType = record.calendar_type === 'lunar' ? 'lunar' : 'solar';
    const event = {
        id,
        title,
        start,
        end,
        allDay: boolOf(record.all_day),
        calendarType,
        recurrence: optional(record.recurrence) ?? 'none',
        createdAt: optional(record.created_at) ?? new Date().toISOString(),
        updatedAt: optional(record.updated_at) ?? new Date().toISOString(),
    };
    if (calendarType === 'lunar') {
        const lunarYear = numberOrUndefined(record.lunar_year);
        const lunarMonth = numberOrUndefined(record.lunar_month);
        const lunarDay = numberOrUndefined(record.lunar_day);
        if (lunarYear !== undefined && lunarMonth !== undefined && lunarDay !== undefined) {
            event.lunarYear = lunarYear;
            event.lunarMonth = lunarMonth;
            event.lunarDay = lunarDay;
            event.lunarLeap = boolOf(record.lunar_leap);
        }
    }
    const category = optional(record.category);
    if (category !== undefined)
        event.category = category;
    const location = optional(record.location);
    if (location !== undefined)
        event.location = location;
    const description = optional(record.description);
    if (description !== undefined)
        event.description = description;
    return event;
}
function serializeEvents(events) {
    return stringifyCsv([[...EVENTS_COLUMNS], ...events.map(eventToRow)]);
}
function parseEvents(text) {
    if (text === null || text.trim() === '')
        return [];
    const rows = parseCsv(text);
    if (rows.length <= 1)
        return [];
    const header = rows[0];
    const events = [];
    for (let i = 1; i < rows.length; i += 1) {
        const event = rowToEvent(rowToRecord(header, rows[i]));
        if (event !== null)
            events.push(event);
    }
    return events;
}
// ─── Todo 行映射 ─────────────────────────────────────────────────────────
function todoToRow(todo) {
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
        todo.calendarType ?? '',
        todo.lunarYear !== undefined ? String(todo.lunarYear) : '',
        todo.lunarMonth !== undefined ? String(todo.lunarMonth) : '',
        todo.lunarDay !== undefined ? String(todo.lunarDay) : '',
        todo.lunarLeap === true ? 'true' : '',
        todo.recurrence ?? '',
        todo.completedDates !== undefined ? todo.completedDates.join('|') : '',
    ];
}
function rowToTodo(record) {
    const id = optional(record.id);
    const title = optional(record.title);
    const date = optional(record.date);
    if (id === undefined || title === undefined || date === undefined)
        return null;
    const status = record.status === 'completed' ? 'completed' : 'pending';
    const todo = {
        id,
        title,
        date,
        status,
        createdAt: optional(record.created_at) ?? new Date().toISOString(),
        updatedAt: optional(record.updated_at) ?? new Date().toISOString(),
    };
    const category = optional(record.category);
    if (category !== undefined)
        todo.category = category;
    const description = optional(record.description);
    if (description !== undefined)
        todo.description = description;
    const completedAt = optional(record.completed_at);
    if (status === 'completed' && completedAt !== undefined)
        todo.completedAt = completedAt;
    // 重复 / 农历（V0.2 新增列；旧文件缺列时容忍）
    const recurrence = optional(record.recurrence);
    if (recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly' || recurrence === 'yearly') {
        todo.recurrence = recurrence;
    }
    const calendarType = record.calendar_type === 'lunar' ? 'lunar' : 'solar';
    if (calendarType === 'lunar') {
        const lunarYear = numberOrUndefined(record.lunar_year);
        const lunarMonth = numberOrUndefined(record.lunar_month);
        const lunarDay = numberOrUndefined(record.lunar_day);
        if (lunarYear !== undefined && lunarMonth !== undefined && lunarDay !== undefined) {
            todo.calendarType = 'lunar';
            todo.lunarYear = lunarYear;
            todo.lunarMonth = lunarMonth;
            todo.lunarDay = lunarDay;
            todo.lunarLeap = boolOf(record.lunar_leap);
        }
    }
    const completedDates = optional(record.completed_dates);
    if (completedDates !== undefined && completedDates !== '') {
        const dates = completedDates.split('|').filter(d => DATE_RE.test(d));
        if (dates.length > 0)
            todo.completedDates = dates;
    }
    return todo;
}
function serializeTodos(todos) {
    return stringifyCsv([[...TODOS_COLUMNS], ...todos.map(todoToRow)]);
}
function parseTodos(text) {
    if (text === null || text.trim() === '')
        return [];
    const rows = parseCsv(text);
    if (rows.length <= 1)
        return [];
    const header = rows[0];
    const todos = [];
    for (let i = 1; i < rows.length; i += 1) {
        const todo = rowToTodo(rowToRecord(header, rows[i]));
        if (todo !== null)
            todos.push(todo);
    }
    return todos;
}
// ─── YAML 辅助 ───────────────────────────────────────────────────────────
/** 读 YAML 文件；不存在或解析失败返回 null。 */
async function readYaml(path) {
    const text = await readFile(path, 'utf8').catch(() => null);
    if (text === null || text.trim() === '')
        return null;
    try {
        return yaml.load(text);
    }
    catch {
        return null;
    }
}
function parseHolidayYear(data, year) {
    if (typeof data !== 'object' || data === null)
        return null;
    const record = data;
    const holidays = [];
    if (Array.isArray(record.holidays)) {
        for (const item of record.holidays) {
            if (typeof item !== 'object' || item === null)
                continue;
            const entry = item;
            const name = typeof entry.name === 'string' ? entry.name : '';
            const dates = Array.isArray(entry.dates) ? entry.dates.filter((d) => typeof d === 'string') : [];
            if (name !== '' && dates.length > 0)
                holidays.push({ name, dates });
        }
    }
    const workdays = Array.isArray(record.workdays)
        ? record.workdays.filter((d) => typeof d === 'string')
        : [];
    return { year, holidays, workdays };
}
// ─── 实现 ────────────────────────────────────────────────────────────────
/**
 * CSV/YAML 本地文件存储。
 */
export class CsvAgendaStorage {
    dataDir;
    backupDir;
    writeOptions;
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.backupDir = join(dataDir, 'backup');
        this.writeOptions = { backupDir: this.backupDir, keepBackups: KEEP_BACKUPS };
    }
    get eventsPath() { return join(this.dataDir, 'events.csv'); }
    get todosPath() { return join(this.dataDir, 'todos.csv'); }
    get categoriesPath() { return join(this.dataDir, 'categories.yaml'); }
    get settingsPath() { return join(this.dataDir, 'settings.yaml'); }
    holidayPath(year) { return join(this.dataDir, 'holidays', `${year}.yaml`); }
    /** 确保目录结构存在（挂载时调用一次）。 */
    async ensureLayout() {
        await mkdir(this.dataDir, { recursive: true });
        await mkdir(join(this.dataDir, 'holidays'), { recursive: true });
        await mkdir(this.backupDir, { recursive: true });
    }
    // ── Event ──
    async listEvents() {
        const text = await readFile(this.eventsPath, 'utf8').catch(() => null);
        return parseEvents(text);
    }
    async mutateEvents(mutate) {
        return withLockedFile(this.eventsPath, this.writeOptions, current => {
            const events = parseEvents(current);
            const outcome = mutate(events);
            return { value: outcome.value, content: serializeEvents(events) };
        });
    }
    // ── Todo ──
    async listTodos() {
        const text = await readFile(this.todosPath, 'utf8').catch(() => null);
        return parseTodos(text);
    }
    async mutateTodos(mutate) {
        return withLockedFile(this.todosPath, this.writeOptions, current => {
            const todos = parseTodos(current);
            const outcome = mutate(todos);
            return { value: outcome.value, content: serializeTodos(todos) };
        });
    }
    // ── 分类 ──
    async listCategories() {
        const data = await readYaml(this.categoriesPath);
        if (data === null || !Array.isArray(data.categories))
            return [];
        return data.categories.filter((c) => typeof c === 'string' && c.trim() !== '');
    }
    async mutateCategories(mutate) {
        return withLockedFile(this.categoriesPath, this.writeOptions, current => {
            let categories;
            if (current === null || current.trim() === '') {
                categories = [];
            }
            else {
                try {
                    const data = yaml.load(current);
                    categories = Array.isArray(data?.categories)
                        ? data.categories.filter((c) => typeof c === 'string' && c.trim() !== '')
                        : [];
                }
                catch {
                    categories = [];
                }
            }
            const outcome = mutate(categories);
            const content = yaml.dump({ categories }, { lineWidth: 120 });
            return { value: outcome.value, content };
        });
    }
    // ── 设置 ──
    async settingsRaw() {
        return readFile(this.settingsPath, 'utf8').catch((error) => { if (error.code === 'ENOENT')
            return null; throw error; });
    }
    settingsRevision(raw) {
        return createHash('sha256').update(raw === null ? 'missing' : 'present\\0' + raw).digest('hex');
    }
    async settingsState() {
        const raw = await this.settingsRaw();
        let weekStart = 'monday';
        try {
            const value = raw === null ? null : yaml.load(raw);
            if (value?.weekStart === 'sunday')
                weekStart = 'sunday';
        }
        catch { /* 保存时严格拒绝错误原件，读取保持默认可用。 */ }
        return { settings: { weekStart }, revision: this.settingsRevision(raw) };
    }
    async loadSettings() {
        if (await this.settingsRaw() === null)
            return null;
        return (await this.settingsState()).settings;
    }
    async saveSettings(settings) {
        await this.updateSettings(settings, (await this.settingsState()).revision);
    }
    async updateSettings(patch, expectedRevision) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => key !== 'weekStart') || (patch.weekStart !== 'monday' && patch.weekStart !== 'sunday')) {
            throw new AgendaError('INVALID_SETTINGS', '周起始日须为周一或周日。');
        }
        await withLockedFile(this.settingsPath, this.writeOptions, current => {
            if (typeof expectedRevision !== 'string' || expectedRevision !== this.settingsRevision(current))
                throw new AgendaError('SETTINGS_CONFLICT', '设置已被其他窗口修改，请刷新后再保存；草稿已保留。');
            let value;
            try {
                value = current === null ? {} : yaml.load(current);
            }
            catch {
                throw new AgendaError('INVALID_SETTINGS', '设置文件格式错误，未覆盖原件。');
            }
            if (!value || typeof value !== 'object' || Array.isArray(value))
                throw new AgendaError('INVALID_SETTINGS', '设置文件须为对象，未覆盖原件。');
            const next = { ...value, weekStart: patch.weekStart };
            const content = value.weekStart === patch.weekStart && current !== null ? current : yaml.dump(next, { lineWidth: 120 });
            return { value: undefined, content };
        });
    }
    // ── 节假日 ──
    async listHolidayYears() {
        const dir = join(this.dataDir, 'holidays');
        const entries = await readdir(dir).catch(() => []);
        const years = [];
        for (const entry of entries) {
            const match = /^(\d{4})\.ya?ml$/.exec(entry);
            if (match !== null)
                years.push(Number(match[1]));
        }
        return years.sort((a, b) => a - b);
    }
    async readHolidayYear(year) {
        let raw;
        try {
            raw = await readFile(this.holidayPath(year), 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
            try {
                raw = await readFile(join(this.dataDir, 'holidays', `${year}.yml`), 'utf8');
            }
            catch (second) {
                if (second.code === 'ENOENT')
                    return null;
                throw second;
            }
        }
        try {
            return normalizeHolidayYear(yaml.load(raw), year);
        }
        catch (error) {
            const reason = error instanceof AgendaError ? error.message : 'YAML 格式错误';
            throw new AgendaError('INVALID_HOLIDAY_DATA', `${year} 年本地放假资料无效：${reason}；原件已保留。`);
        }
    }
    async writeHolidayYear(data) {
        const content = yaml.dump({
            year: data.year,
            holidays: data.holidays.map(holiday => ({ name: holiday.name, dates: holiday.dates })),
            workdays: data.workdays,
        }, { lineWidth: 120 });
        await atomicWriteFile(this.holidayPath(data.year), content, this.writeOptions);
    }
    /** 调试用：直接写一个文本文件（seed 脚本/测试使用）。 */
    async writeRaw(path, content) {
        await writeFile(path, content, 'utf8');
    }
}
