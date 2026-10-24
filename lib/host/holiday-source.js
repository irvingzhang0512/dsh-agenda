/** 只读已安装 npm 年度 JSON；固定旧 YAML 仅用于识别本地修改。 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { normalizeHolidayYear, holidayName } from "../core/holiday-data.js";
import { AgendaError } from "../core/errors.js";
export function createHolidaySource() {
    const root = dirname(createRequire(import.meta.url).resolve('chinese-days/package.json'));
    const cache = new Map();
    const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
    const years = readdir(join(root, 'dist/years')).then(names => names.filter(n => /^\d{4}\.json$/.test(n)).map(n => Number(n.slice(0, 4))).sort((a, b) => a - b));
    return {
        packageVersion: version,
        availableYears: () => years,
        loadYear: async (year) => {
            if (!(await years).includes(year))
                return null;
            if (!cache.has(year))
                cache.set(year, readFile(join(root, 'dist/years', `${year}.json`), 'utf8').then(text => {
                    const raw = JSON.parse(text);
                    if (!raw || !raw.holidays || !raw.workdays || Array.isArray(raw.holidays) || Array.isArray(raw.workdays))
                        throw new AgendaError('INVALID_HOLIDAY_DATA', '节假日库年度格式不兼容。');
                    const names = new Map();
                    for (const [date, value] of Object.entries(raw.holidays)) {
                        if (typeof value !== 'string' || !value.split(',')[1])
                            throw new AgendaError('INVALID_HOLIDAY_DATA', '节假日库名称格式不兼容。');
                        const name = holidayName(value.split(',')[1]);
                        const dates = names.get(name) ?? [];
                        dates.push(date);
                        names.set(name, dates);
                    }
                    for (const value of Object.values(raw.workdays)) {
                        if (typeof value !== 'string' || !value.split(',')[1])
                            throw new AgendaError('INVALID_HOLIDAY_DATA', '节假日库调休名称格式不兼容。');
                    }
                    return normalizeHolidayYear({ year, holidays: [...names].map(([name, dates]) => ({ name, dates })), workdays: Object.keys(raw.workdays) }, year);
                }));
            return cache.get(year);
        },
        legacyYear: async (year) => {
            if (year !== 2025 && year !== 2026)
                return null;
            const raw = yaml.load(await readFile(new URL(`../../holidays/${year}.yaml`, import.meta.url), 'utf8'));
            return normalizeHolidayYear(raw, year);
        },
    };
}
