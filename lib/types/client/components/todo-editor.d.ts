import type { AgendaTodo } from '../../shared/types.ts';
export type TodoEditorMode = {
    kind: 'create';
    date?: string;
} | {
    kind: 'edit';
    todo: AgendaTodo;
};
export declare function TodoEditor({ mode, onClose }: {
    mode: TodoEditorMode;
    onClose: () => void;
}): React.ReactElement;
