/**
 * dsh-agenda — 应用壳：主导航 + 视图切换 + 全局编辑器状态。
 */
import { useEffect, useState } from 'react'
import { usePersistentState } from './persistent-state.ts'
import { SegmentedTabs, Button } from './primitives.ts'
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
  const { client, connected, error } = useAgenda()
  const [view, setView] = usePersistentState<ViewKey>('app.view', 'today')
  const [editor, setEditor] = usePersistentState<EditorMode | null>('app.editor', null)
  const [todoEditor, setTodoEditor] = usePersistentState<TodoEditorMode | null>('app.todoEditor', null)

  const closeEditor = (prefix: string): void => {
    for (const key of client.uiState.keys()) if (key.startsWith(prefix + '.')) client.uiState.delete(key)
    if (prefix === 'eventEditor') setEditor(null)
    else setTodoEditor(null)
  }

  // 每次客户端启动以今天为初始日期。
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
        <SegmentedTabs className="da-nav" label="日程视图" value={view} onChange={value => setView(value as ViewKey)} items={[{value:'today',label:'今天'},{value:'month',label:'月历'},{value:'week',label:'周历'},{value:'todo',label:'待办'},{value:'stats',label:'统计'},{value:'search',label:'搜索'}]} />
        <Button disabled={!connected} onClick={() => openNewEvent()}>＋ 新建日程</Button>
      </div>

      <div className="da-main">
        {!connected && (
          <div className="da-card" style={{ marginBottom: 12, color: 'var(--da-text-dim)' }}>
            日程服务尚未连接；暂时无法提交操作。{error !== null ? `（${error}）` : ''}
          </div>
        )}
        {connected && error && <div className="da-card" role="alert">{error} <button className="da-btn" onClick={() => void client.refresh().catch(() => undefined)}>刷新核对</button></div>}
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

      {editor !== null && <EventEditor mode={editor} onClose={() => closeEditor('eventEditor')} />}
      {todoEditor !== null && <TodoEditor mode={todoEditor} onClose={() => closeEditor('todoEditor')} />}
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
