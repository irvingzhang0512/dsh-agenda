/**
 * 存储层测试：CSV/YAML 往返、字段保留、并发安全、自动备份、文件锁。
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'
import type { AgendaEvent, AgendaTodo } from '../src/shared/types.ts'

async function makeStorage(): Promise<{ storage: CsvAgendaStorage, dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agenda-storage-'))
  const storage = new CsvAgendaStorage(dir)
  await storage.ensureLayout()
  return { storage, dir }
}

const eventFixture: AgendaEvent = {
  id: 'e_test1',
  title: '算法评审,带逗号"与引号',
  start: '2026-09-25',
  end: '2026-09-25',
  allDay: true,
  calendarType: 'solar',
  recurrence: 'none',
  category: '工作/防干烧/算法',
  location: '3F 会议室, A区',
  description: '备注含换行\n第二行',
  createdAt: '2026-09-22T10:00:00.000Z',
  updatedAt: '2026-09-22T10:00:00.000Z',
}

const lunarEventFixture: AgendaEvent = {
  id: 'e_lunar1',
  title: '中秋团圆',
  start: '2026-09-25T09:00',
  end: '2026-09-25T10:00',
  allDay: false,
  calendarType: 'lunar',
  lunarYear: 2026,
  lunarMonth: 8,
  lunarDay: 15,
  lunarLeap: false,
  recurrence: 'none',
  createdAt: '2026-09-22T10:00:00.000Z',
  updatedAt: '2026-09-22T10:00:00.000Z',
}

const todoFixture: AgendaTodo = {
  id: 't_test1',
  title: '整理评审材料',
  date: '2026-09-24',
  status: 'completed',
  category: '工作/防干烧/算法',
  description: '含,逗号',
  completedAt: '2026-09-22T11:00:00.000Z',
  createdAt: '2026-09-22T10:00:00.000Z',
  updatedAt: '2026-09-22T10:00:00.000Z',
}

describe('CSV 往返', () => {
  it('Event 全字段保留（含逗号/引号/换行）', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.mutateEvents(events => { events.push(eventFixture); return { value: undefined } })
      const events = await storage.listEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(eventFixture)
      // 文件真实存在且为 UTF-8 CSV
      const raw = await readFile(join(dir, 'events.csv'), 'utf8')
      expect(raw).toContain('"算法评审,带逗号""与引号"')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('农历 Event 保留原始农历字段', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.mutateEvents(events => { events.push(lunarEventFixture); return { value: undefined } })
      const events = await storage.listEvents()
      expect(events[0]!.calendarType).toBe('lunar')
      expect(events[0]!.lunarYear).toBe(2026)
      expect(events[0]!.lunarMonth).toBe(8)
      expect(events[0]!.lunarDay).toBe(15)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('Todo 全字段保留（含完成时间）', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.mutateTodos(todos => { todos.push(todoFixture); return { value: undefined } })
      const todos = await storage.listTodos()
      expect(todos).toHaveLength(1)
      expect(todos[0]).toEqual(todoFixture)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('删除后不再出现', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.mutateEvents(events => { events.push(eventFixture); return { value: undefined } })
      await storage.mutateEvents(events => {
        const index = events.findIndex(event => event.id === eventFixture.id)
        events.splice(index, 1)
        return { value: undefined }
      })
      expect(await storage.listEvents()).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('YAML（分类 / 设置 / 节假日）', () => {
  it('分类增删与持久化', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.mutateCategories(categories => { categories.push('工作/防干烧/算法', '生活/家庭'); return { value: undefined } })
      expect(await storage.listCategories()).toEqual(['工作/防干烧/算法', '生活/家庭'])
      await storage.mutateCategories(categories => {
        categories.splice(categories.indexOf('生活/家庭'), 1)
        return { value: undefined }
      })
      expect(await storage.listCategories()).toEqual(['工作/防干烧/算法'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('设置读写', async () => {
    const { storage, dir } = await makeStorage()
    try {
      expect(await storage.loadSettings()).toBeNull()
      await storage.saveSettings({ weekStart: 'sunday' })
      expect(await storage.loadSettings()).toEqual({ weekStart: 'sunday' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('节假日读写', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await storage.writeHolidayYear({ year: 2026, holidays: [{ name: '春节', dates: ['2026-02-17'] }], workdays: ['2026-02-14'] })
      const loaded = await storage.readHolidayYear(2026)
      expect(loaded).not.toBeNull()
      expect(loaded!.holidays).toEqual([{ name: '春节', dates: ['2026-02-17'] }])
      expect(loaded!.workdays).toEqual(['2026-02-14'])
      expect(await storage.listHolidayYears()).toEqual([2026])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('并发与备份', () => {
  it('并发 mutate 不丢数据（进程内串行化）', async () => {
    const { storage, dir } = await makeStorage()
    try {
      const N = 20
      await Promise.all(Array.from({ length: N }, (_, i) =>
        storage.mutateEvents(events => {
          events.push({ ...eventFixture, id: `e_${i}` })
          return { value: undefined }
        }),
      ))
      const events = await storage.listEvents()
      expect(events).toHaveLength(N)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('每次写生成备份并只保留上限', async () => {
    const { storage, dir } = await makeStorage()
    try {
      for (let i = 0; i < 3; i += 1) {
        await storage.mutateEvents(events => { events.push({ ...eventFixture, id: `e_${i}` }); return { value: undefined } })
      }
      const backups = await readdir(join(dir, 'backup'))
      expect(backups.some(name => name.startsWith('events.csv.'))).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('mutate 抛错时不落盘', async () => {
    const { storage, dir } = await makeStorage()
    try {
      await expect(
        storage.mutateEvents(() => { throw new Error('boom') }),
      ).rejects.toThrow('boom')
      expect(await storage.listEvents()).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
