/**
 * AgendaService 业务测试：CRUD、公历/农历两条路径、分类自动登记、统计、搜索、校验。
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CsvAgendaStorage } from '../src/storage/csv-storage.ts'
import { AgendaService } from '../src/core/agenda.ts'
import { AgendaError } from '../src/core/errors.ts'
import { writeHolidaySeed } from './helpers.ts'

const NOW = new Date('2026-09-22T08:00:00.000Z')

async function makeService(): Promise<{ service: AgendaService, dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agenda-svc-'))
  const storage = new CsvAgendaStorage(dir)
  await storage.ensureLayout()
  await writeHolidaySeed(storage)
  const service = new AgendaService(storage, { now: () => NOW })
  return { service, dir }
}

describe('Event：公历创建', () => {
  it('全天事件 start 为日期', async () => {
    const { service, dir } = await makeService()
    try {
      const event = await service.createEvent({ title: '项目结项', start: '2026-10-01', allDay: true })
      expect(event.allDay).toBe(true)
      expect(event.start).toBe('2026-10-01')
      expect(event.end).toBe('2026-10-01')
      expect(event.calendarType).toBe('solar')
      expect(event.id.startsWith('e_')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('定时事件 start/end 为 datetime；end 省略 = 开始 + 1 小时', async () => {
    const { service, dir } = await makeService()
    try {
      const event = await service.createEvent({ title: '评审', start: '2026-09-25T15:00' })
      expect(event.allDay).toBe(false)
      expect(event.start).toBe('2026-09-25T15:00')
      expect(event.end).toBe('2026-09-25T16:00')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('新分类首次引用自动登记', async () => {
    const { service, dir } = await makeService()
    try {
      await service.createEvent({ title: '评审', start: '2026-09-25T15:00', category: '工作/防干烧/算法' })
      const categories = await service.listCategories()
      expect(categories).toContain('工作/防干烧/算法')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('空标题 / 非法日期被拒绝', async () => {
    const { service, dir } = await makeService()
    try {
      await expect(service.createEvent({ title: '  ', start: '2026-09-25' })).rejects.toMatchObject({ code: 'INVALID_TITLE' })
      await expect(service.createEvent({ title: 'x', start: '2026-02-30' })).rejects.toMatchObject({ code: 'INVALID_DATE' })
      await expect(service.createEvent({ title: 'x', start: '2026-13-01' })).rejects.toMatchObject({ code: 'INVALID_DATE' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Event：农历创建', () => {
  it('农历八月十五换算为 2026-09-25 并保留原始字段', async () => {
    const { service, dir } = await makeService()
    try {
      const event = await service.createEvent({
        title: '中秋团圆', calendarType: 'lunar', lunarYear: 2026, lunarMonth: 8, lunarDay: 15,
      })
      expect(event.calendarType).toBe('lunar')
      expect(event.start).toBe('2026-09-25T09:00')
      expect(event.end).toBe('2026-09-25T10:00')
      expect(event.lunarYear).toBe(2026)
      expect(event.lunarMonth).toBe(8)
      expect(event.lunarDay).toBe(15)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('农历全天事件不带时间', async () => {
    const { service, dir } = await makeService()
    try {
      const event = await service.createEvent({
        title: '春节', calendarType: 'lunar', lunarYear: 2026, lunarMonth: 1, lunarDay: 1, allDay: true,
      })
      expect(event.start).toBe('2026-02-17')
      expect(event.end).toBe('2026-02-17')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('闰月农历事件', async () => {
    const { service, dir } = await makeService()
    try {
      const event = await service.createEvent({
        title: '闰月纪念', calendarType: 'lunar', lunarYear: 2020, lunarMonth: 4, lunarDay: 1, lunarLeap: true, allDay: true,
      })
      expect(event.start).toBe('2020-05-23')
      expect(event.lunarLeap).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('非法农历日期被拒绝', async () => {
    const { service, dir } = await makeService()
    try {
      await expect(service.createEvent({ title: 'x', calendarType: 'lunar', lunarYear: 2025, lunarMonth: 2, lunarDay: 30 }))
        .rejects.toMatchObject({ code: 'INVALID_LUNAR' })
      await expect(service.createEvent({ title: 'x', calendarType: 'lunar', lunarYear: 1800, lunarMonth: 1, lunarDay: 1 }))
        .rejects.toMatchObject({ code: 'INVALID_LUNAR' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Event：修改与删除', () => {
  it('更新标题与分类；空串清除分类', async () => {
    const { service, dir } = await makeService()
    try {
      const created = await service.createEvent({ title: '评审', start: '2026-09-25T15:00', category: '工作/防干烧/算法' })
      const renamed = await service.updateEvent(created.id, { title: '算法评审' })
      expect(renamed.title).toBe('算法评审')
      expect(renamed.category).toBe('工作/防干烧/算法')
      const cleared = await service.updateEvent(created.id, { category: '' })
      expect(cleared.category).toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('公历 → 农历切换：公历字段被忽略，按农历重新换算', async () => {
    const { service, dir } = await makeService()
    try {
      const created = await service.createEvent({ title: '旧安排', start: '2026-09-25T15:00' })
      const lunar = await service.updateEvent(created.id, {
        calendarType: 'lunar', lunarYear: 2026, lunarMonth: 8, lunarDay: 15, allDay: true,
      })
      expect(lunar.calendarType).toBe('lunar')
      expect(lunar.start).toBe('2026-09-25')
      expect(lunar.lunarMonth).toBe(8)
      expect(lunar.lunarDay).toBe(15)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('农历 → 公历切换', async () => {
    const { service, dir } = await makeService()
    try {
      const created = await service.createEvent({ title: '中秋', calendarType: 'lunar', lunarYear: 2026, lunarMonth: 8, lunarDay: 15, allDay: true })
      const solar = await service.updateEvent(created.id, { calendarType: 'solar', start: '2026-10-01' })
      expect(solar.calendarType).toBe('solar')
      expect(solar.start).toBe('2026-10-01')
      expect(solar.lunarMonth).toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('删除不存在的事件抛 NOT_FOUND', async () => {
    const { service, dir } = await makeService()
    try {
      await expect(service.deleteEvent('e_missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Todo：CRUD 与状态', () => {
  it('创建 → 完成 → 重开', async () => {
    const { service, dir } = await makeService()
    try {
      const todo = await service.createTodo({ title: '整理材料', date: '2026-09-24' })
      expect(todo.status).toBe('pending')
      expect(todo.id.startsWith('t_')).toBe(true)

      const done = await service.setTodoStatus(todo.id, 'completed')
      expect(done.status).toBe('completed')
      expect(done.completedAt).toBe(NOW.toISOString())

      const reopened = await service.setTodoStatus(todo.id, 'pending')
      expect(reopened.status).toBe('pending')
      expect(reopened.completedAt).toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('按日期范围与状态过滤', async () => {
    const { service, dir } = await makeService()
    try {
      await service.createTodo({ title: 'A', date: '2026-09-23' })
      await service.createTodo({ title: 'B', date: '2026-09-30' })
      await service.setTodoStatus((await service.listTodos())[0]!.id, 'completed')
      const pending = await service.listTodos({ from: '2026-09-01', to: '2026-09-30' }, 'pending')
      expect(pending).toHaveLength(1)
      expect(pending[0]!.title).toBe('B')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('删除待办', async () => {
    const { service, dir } = await makeService()
    try {
      const todo = await service.createTodo({ title: '临时', date: '2026-09-24' })
      await service.deleteTodo(todo.id)
      expect(await service.getTodo(todo.id)).toBeNull()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('日历信息 calendarInfo', () => {
  it('2026-09-25 为中秋（农历八月十五，官方 3 天假期首日）', async () => {
    const { service, dir } = await makeService()
    try {
      const days = await service.calendarInfo('2026-09-24', '2026-09-27')
      expect(days).toHaveLength(4)
      const mid = days[1]!
      expect(mid.date).toBe('2026-09-25')
      expect(mid.lunarText).toBe('十五')
      expect(mid.festival).toBe('中秋节')
      expect(mid.dayType).toBe('holiday')
      expect(mid.holidayName).toBe('中秋节')
      expect(mid.weekday).toBe(5) // 周五
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('节假日与调休标记（2026 春节 2-17、调休 2-14）', async () => {
    const { service, dir } = await makeService()
    try {
      const days = await service.calendarInfo('2026-02-14', '2026-02-17')
      expect(days[0]!.dayType).toBe('adjusted-workday') // 周六调休上班
      expect(days[3]!.dayType).toBe('holiday')
      expect(days[3]!.holidayName).toBe('春节')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('范围过大被拒绝', async () => {
    const { service, dir } = await makeService()
    try {
      await expect(service.calendarInfo('2026-01-01', '2027-12-31')).rejects.toMatchObject({ code: 'RANGE_TOO_LARGE' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('统计 statistics', () => {
  it('聚合日程/待办与时长、按分类分组', async () => {
    const { service, dir } = await makeService()
    try {
      await service.createEvent({ title: '全天', start: '2026-09-20', allDay: true, category: '生活' })
      await service.createEvent({ title: '评审', start: '2026-09-25T14:00', end: '2026-09-25T16:00', category: '工作/防干烧/算法' })
      await service.createEvent({ title: '电话', start: '2026-09-26T10:00', end: '2026-09-26T10:30' })
      await service.createTodo({ title: 'todoA', date: '2026-09-25', category: '工作' })
      await service.setTodoStatus((await service.listTodos({ from: '2026-09-01', to: '2026-09-30' }, 'pending'))[0]!.id, 'completed')

      const stats = await service.statistics({ from: '2026-09-01', to: '2026-09-30' })
      expect(stats.eventCount).toBe(3)
      expect(stats.allDayEventCount).toBe(1)
      expect(stats.eventHours).toBe(2.5)
      expect(stats.todoCount).toBe(1)
      expect(stats.todoCompleted).toBe(1)
      expect(stats.todoCompletionRate).toBe(1)
      const byCategory = stats.byCategory
      expect(byCategory.map(row => row.category).sort()).toEqual(['工作', '工作/防干烧/算法', '生活', '未分类'].sort())
      const algorithm = byCategory.find(row => row.category === '工作/防干烧/算法')
      expect(algorithm!.eventHours).toBe(2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('搜索 search', () => {
  it('匹配标题/备注/分类，大小写不敏感，支持范围过滤', async () => {
    const { service, dir } = await makeService()
    try {
      await service.createEvent({ title: '算法评审', start: '2026-09-25T15:00', description: '防干烧专题' })
      await service.createEvent({ title: '散步', start: '2026-09-26T07:00', category: '生活/运动' })
      await service.createTodo({ title: '整理算法材料', date: '2026-09-24' })

      const byTitle = await service.search('算法')
      expect(byTitle.events).toHaveLength(1)
      expect(byTitle.todos).toHaveLength(1)

      const byDesc = await service.search('防干烧')
      expect(byDesc.events).toHaveLength(1)
      expect(byDesc.events[0]!.title).toBe('算法评审')

      const byCat = await service.search('运动')
      expect(byCat.events).toHaveLength(1)
      expect(byCat.events[0]!.title).toBe('散步')

      const ranged = await service.search('算法', { eventsRange: { from: '2026-09-01', to: '2026-09-30' } })
      expect(ranged.eventTotal).toBe(1)

      const none = await service.search('不存在')
      expect(none.events).toHaveLength(0)
      expect(none.todos).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('空搜索词被拒绝', async () => {
    const { service, dir } = await makeService()
    try {
      await expect(service.search('  ')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('快照与设置', () => {
  it('快照包含全部数据与 dataVersion 递增', async () => {
    const { service, dir } = await makeService()
    try {
      const v0 = await service.snapshot()
      expect(v0.dataVersion).toBe(0)
      expect(v0.settings.weekStart).toBe('monday')
      await service.createEvent({ title: 'x', start: '2026-09-25' })
      const v1 = await service.snapshot()
      expect(v1.dataVersion).toBe(1)
      expect(v1.events).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('自定义 now 反映到 today 标记', async () => {
    const { service, dir } = await makeService()
    try {
      const days = await service.calendarInfo('2026-09-22', '2026-09-22')
      expect(days[0]!.isToday).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('错误码', () => {
  it('AgendaError 携带稳定 code', async () => {
    const { service, dir } = await makeService()
    try {
      try {
        await service.createEvent({ title: '', start: '2026-09-25' })
        expect.unreachable('应当抛错')
      } catch (error) {
        expect(error).toBeInstanceOf(AgendaError)
        expect((error as AgendaError).code).toBe('INVALID_TITLE')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
