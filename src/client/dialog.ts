/** 可访问弹窗：键盘焦点闭环与焦点返回；回调始终读取最新草稿。 */
import { useEffect, useRef } from 'react'
export function useDialog(close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef(close); latest.current = close
  useEffect(() => {
    const root = ref.current, previous = document.activeElement as HTMLElement | null
    if (!root) return
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(x => x.getClientRects().length > 0)
    ;(focusable()[0] ?? root).focus()
    const key = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === 'Escape') { event.preventDefault(); latest.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); root.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    root.addEventListener('keydown', key)
    return () => { root.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLElement>('.da-root button')?.focus() }
  }, [])
  return ref
}
