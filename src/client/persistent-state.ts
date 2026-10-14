/** 插件实例内的页面状态；切主面板不丢草稿，卸载即释放。 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useAgenda } from './agenda-context.tsx'
export function usePersistentState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const { client } = useAgenda()
  const [value, setValue] = useState<T>(() => {
    if (!client.uiState.has(key)) client.uiState.set(key, typeof initial === 'function' ? (initial as () => T)() : initial)
    return client.uiState.get(key) as T
  })
  return [value, next => setValue(previous => {
    const value = typeof next === 'function' ? (next as (p: T) => T)(previous) : next
    client.uiState.set(key, value)
    return value
  })]
}
