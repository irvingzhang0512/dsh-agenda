import { mergeHolidayYear } from "./holiday-data.js";
export class HolidayService {
    storage;
    source;
    cache = new Map();
    lastGood = new Map();
    state = new Map();
    fingerprint = '';
    constructor(storage, source) {
        this.storage = storage;
        this.source = source;
    }
    async loadYear(year) {
        const cached = this.cache.get(year);
        if (cached && Date.now() - cached.loadedAt < 60_000)
            return cached.data;
        let base = null, legacy = null, warning;
        try {
            base = await this.source?.loadYear(year) ?? null;
        }
        catch {
            warning = `${year} 年节假日库资料不可用。`;
        }
        let local = null;
        try {
            local = await this.storage.readHolidayYear(year);
        }
        catch (error) {
            warning = error instanceof Error ? error.message : `${year} 年本地放假资料无效，原件已保留。`;
            const data = this.lastGood.has(year) ? this.lastGood.get(year) : base;
            const previous = this.state.get(year);
            this.state.set(year, { overridden: previous?.overridden ?? false, legacyFull: previous?.legacyFull ?? false, warning });
            this.cache.set(year, { loadedAt: Date.now(), data });
            return data;
        }
        if (local)
            try {
                legacy = await this.source?.legacyYear(year) ?? null;
            }
            catch {
                warning = `${year} 年旧默认基线不可用，已保留本地整年资料。`;
            }
        const merged = mergeHolidayYear(base, local, legacy);
        this.state.set(year, { overridden: merged.overridden, legacyFull: merged.legacyFull, ...(warning ? { warning } : {}) });
        this.cache.set(year, { loadedAt: Date.now(), data: merged.data });
        if (!warning)
            this.lastGood.set(year, merged.data);
        return merged.data;
    }
    async writeYear(data) {
        await this.storage.writeHolidayYear(data);
        this.cache.delete(data.year);
    }
    async availableYears() {
        const local = await this.storage.listHolidayYears();
        const library = await this.source?.availableYears().catch(() => []) ?? [];
        return [...new Set([...local, ...library])].sort((a, b) => a - b);
    }
    async summary() {
        const supportedYears = await this.source?.availableYears().catch(() => []) ?? [];
        const local = await this.storage.listHolidayYears();
        await Promise.all([...new Set([...supportedYears, ...local])].map(year => this.loadYear(year)));
        const entries = [...this.state].sort(([a], [b]) => a - b);
        const summary = {
            packageVersion: this.source?.packageVersion ?? 'local',
            supportedYears,
            localOverrideYears: entries.filter(([, s]) => s.overridden).map(([y]) => y),
            legacyFullYears: entries.filter(([, s]) => s.legacyFull).map(([y]) => y),
            warnings: entries.flatMap(([, s]) => s.warning ? [s.warning] : []),
        };
        const live = new Set([...supportedYears, ...local]);
        this.fingerprint = JSON.stringify({ summary, data: [...this.cache].filter(([y]) => live.has(y)).sort(([a], [b]) => a - b).map(([y, s]) => [y, s.data]) });
        return summary;
    }
    async refresh() {
        const previous = this.fingerprint || (await this.summary(), this.fingerprint);
        this.cache.clear();
        const local = await this.storage.listHolidayYears(), supported = await this.source?.availableYears().catch(() => []) ?? [];
        const live = new Set([...local, ...supported]);
        for (const y of this.state.keys())
            if (!live.has(y)) {
                this.state.delete(y);
                this.lastGood.delete(y);
            }
        await this.summary();
        return previous !== this.fingerprint;
    }
    async dayKind(date, weekday) {
        const data = await this.loadYear(Number(date.slice(0, 4)));
        if (data?.workdays.includes(date))
            return { type: 'adjusted-workday' };
        for (const h of data?.holidays ?? [])
            if (h.dates.includes(date))
                return { type: 'holiday', holidayName: h.name };
        return { type: weekday === 6 || weekday === 7 ? 'weekend' : 'workday' };
    }
}
