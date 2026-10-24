import type { TodoEditorMode } from '../components/todo-editor.tsx';
export declare function TodoView({ onEditTodo, onNewTodo, }: {
    onEditTodo: (mode: TodoEditorMode) => void;
    onNewTodo: (date?: string) => void;
}): React.ReactElement;
