import type { EditorMode } from '../components/event-editor.tsx';
import type { TodoEditorMode } from '../components/todo-editor.tsx';
export declare function SearchView({ onEditEvent, onEditTodo, }: {
    onEditEvent: (mode: EditorMode) => void;
    onEditTodo: (mode: TodoEditorMode) => void;
}): React.ReactElement;
