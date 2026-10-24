import type { ComponentType, ButtonHTMLAttributes } from 'react';
export declare const Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
}>, SegmentedTabs: ComponentType<{
    items: Array<{
        value: string;
        label: string;
    }>;
    value: string;
    onChange: (value: string) => void;
    label: string;
    className?: string;
}>;
