import type { DayInfo } from '../../shared/types.ts';
import type { EditorMode } from './event-editor.tsx';
import type { TodoEditorMode } from './todo-editor.tsx';
export declare function DayDetail({ date, dayInfo, onClose, onEditEvent, onEditTodo, onNewEvent, onNewTodo, }: {
    date: string;
    dayInfo: DayInfo | null;
    onClose: () => void;
    onEditEvent: (mode: EditorMode) => void;
    onEditTodo: (mode: TodoEditorMode) => void;
    onNewEvent: (date: string) => void;
    onNewTodo: (date: string) => void;
}): React.ReactElement;
