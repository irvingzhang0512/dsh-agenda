import type { AgendaEvent, EventInput } from '../../shared/types.ts';
export type EditorMode = {
    kind: 'create';
    defaults?: EventInput;
    date?: string;
    hour?: string;
} | {
    kind: 'edit';
    event: AgendaEvent;
};
export declare function EventEditor({ mode, onClose }: {
    mode: EditorMode;
    onClose: () => void;
}): React.ReactElement;
