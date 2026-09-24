/**
 * dsh-agenda — 应用壳：主导航 + 视图切换 + 全局编辑器状态。
 */
import { useEffect, useState } from 'react'
import { AgendaProvider, useAgenda } from './agenda-context.tsx'
import type { AgendaClient } from './api.ts'
import { todayISO } from '../shared/types.ts'
import { TodayView } from './views/today-view.tsx'
import { MonthView } from './views/month-view.tsx'
import { WeekView } from './views/week-view.tsx'
import { TodoView } from './views/todo-view.tsx'
import { StatisticsView } from './views/statistics-view.tsx'
import { SearchView } from './views/search-view.tsx'
import { EventEditor } from './components/event-editor.tsx'
import type { EditorMode } from './components/event-editor.tsx'
import { TodoEditor } from './components/todo-editor.tsx'
import type { TodoEditorMode } from './components/todo-editor.tsx'

type ViewKey = 'today' | 'month' | 'week' | 'todo' | 'stats' | 'search'

function AgendaAppInner(): React.ReactElement {
  const { connected, error } = useAgenda()
  const [view, setView] = useState<ViewKey>('today')
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const [todoEditor, setTodoEditor] = useState<TodoEditorMode | null>(null)

  // 视图重新挂载的锚点（切回月/周时定位到今天）
  const today = todayISO()

  const openNewEvent = (date?: string, hour?: string): void => {
    setEditor({ kind: 'create', date, hour })
  }
  const openNewTodo = (date?: string): void => {
    setTodoEditor({ kind: 'create', date })
  }

  return (
    <div className="da-root">
      <div className="da-header">
        <h1>日程</h1>
        <div className="da-nav">
          <button type="button" className={view === 'today' ? 'da-active' : ''} onClick={() => setView('today')}>今天</button>
          <button type="button" className={view === 'month' ? 'da-active' : ''} onClick={() => setView('month')}>月历</button>
          <button type="button" className={view === 'week' ? 'da-active' : ''} onClick={() => setView('week')}>周历</button>
          <button type="button" className={view === 'todo' ? 'da-active' : ''} onClick={() => setView('todo')}>待办</button>
          <button type="button" className={view === 'stats' ? 'da-active' : ''} onClick={() => setView('stats')}>统计</button>
          <button type="button" className={view === 'search' ? 'da-active' : ''} onClick={() => setView('search')}>搜索</button>
        </div>
        <button type="button" className="da-btn da-primary" onClick={() => openNewEvent()}>＋ 新建日程</button>
      </div>

      <div className="da-main">
        {!connected && (
          <div className="da-card" style={{ marginBottom: 12, color: 'var(--da-text-dim)' }}>
            正在连接日程服务…{error !== null ? `（${error}）` : ''}
          </div>
        )}
        {view === 'today' && (
          <TodayView
            onEditEvent={setEditor}
            onNewEvent={openNewEvent}
            onEditTodo={setTodoEditor}
            onNewTodo={openNewTodo}
          />
        )}
        {view === 'month' && (
          <MonthView
            key={`month-${today}`}
            initialMonth={today.slice(0, 7)}
            onEditEvent={setEditor}
            onNewEvent={openNewEvent}
            onEditTodo={setTodoEditor}
            onNewTodo={openNewTodo}
          />
        )}
        {view === 'week' && (
          <WeekView
            key={`week-${today}`}
            initialDate={today}
            onEditEvent={setEditor}
            onNewEvent={openNewEvent}
          />
        )}
        {view === 'todo' && (
          <TodoView
            onEditTodo={setTodoEditor}
            onNewTodo={openNewTodo}
          />
        )}
        {view === 'stats' && <StatisticsView />}
        {view === 'search' && (
          <SearchView
            onEditEvent={setEditor}
            onEditTodo={setTodoEditor}
          />
        )}
      </div>

      {editor !== null && <EventEditor mode={editor} onClose={() => setEditor(null)} />}
      {todoEditor !== null && <TodoEditor mode={todoEditor} onClose={() => setTodoEditor(null)} />}
    </div>
  )
}

/** 面板根（供 slots.register 渲染）。 */
export function AgendaApp({ client }: { client: AgendaClient }): React.ReactElement {
  return (
    <AgendaProvider client={client}>
      <AgendaAppInner />
    </AgendaProvider>
  )
}
