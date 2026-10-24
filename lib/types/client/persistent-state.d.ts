import type { Dispatch, SetStateAction } from 'react';
export declare function usePersistentState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
