import type { AgendaService } from '../core/agenda.ts';
/** 工具名（与 SKILL/docs 契约保持一致）。 */
export declare const AGENDA_TOOL_NAMES: readonly ["agenda_create_event", "agenda_get_event", "agenda_update_event", "agenda_delete_event", "agenda_list_events", "agenda_search_events", "agenda_create_todo", "agenda_update_todo", "agenda_complete_todo", "agenda_delete_todo", "agenda_list_todos", "agenda_search_todos", "agenda_get_statistics"];
export type AgendaToolName = (typeof AGENDA_TOOL_NAMES)[number];
/** 工具依赖（注入以便测试）。 */
export interface AgendaToolDeps {
    service: AgendaService;
}
/** 注册 13 个工具；返回组合 disposer。 */
export declare function registerAgendaTools(ctx: {
    tools: {
        register(tool: unknown): () => void;
    };
}, deps: AgendaToolDeps): () => void;
