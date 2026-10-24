import type { EditorMode } from '../components/event-editor.tsx';
import type { TodoEditorMode } from '../components/todo-editor.tsx';
export declare function MonthView({ initialMonth, onEditEvent, onNewEvent, onEditTodo, onNewTodo, }: {
    initialMonth: string;
    onEditEvent: (mode: EditorMode) => void;
    onNewEvent: (date: string) => void;
    onEditTodo: (mode: TodoEditorMode) => void;
    onNewTodo: (date: string) => void;
}): React.ReactElement;
