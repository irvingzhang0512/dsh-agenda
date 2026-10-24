import type { EditorMode } from '../components/event-editor.tsx';
export declare function WeekView({ initialDate, onEditEvent, onNewEvent, }: {
    initialDate: string;
    onEditEvent: (mode: EditorMode) => void;
    onNewEvent: (date: string, hour: string) => void;
}): React.ReactElement;
