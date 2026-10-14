import type { ComponentType, ButtonHTMLAttributes } from 'react'
declare const require: (id: string) => unknown
export const { Button, SegmentedTabs } = require('@deepseek-ai/dsh-client-ui-primitives') as {
  Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }>
  SegmentedTabs: ComponentType<{ items: Array<{ value: string, label: string }>, value: string, onChange: (value: string) => void, label: string, className?: string }>
}
