import { useEffect } from 'react'

export interface Shortcut {
  /** KeyboardEvent.key, 不区分大小写 */
  readonly key: string
  readonly mod?: boolean
  readonly shift?: boolean
  readonly run: () => void
}

const EDITABLE = 'input, textarea, select, [contenteditable="true"]'
const ACTIVATABLE = 'button, a[href], summary, [role="button"], [role="radio"], [role="tab"]'
const ACTIVATION_KEYS = new Set([' ', 'enter'])

/**
 * 全局快捷键不得与获得焦点的控件自身的按键行为冲突 (章程原则 IV):
 * 控件已处理(defaultPrevented)、焦点在可编辑控件内、或按键会激活当前按钮时, 一律不触发.
 */
export const shouldIgnore = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented) return true
  const target = event.target
  if (!(target instanceof Element)) return false
  if (target.closest(EDITABLE)) return true
  return ACTIVATION_KEYS.has(event.key.toLowerCase()) && target.closest(ACTIVATABLE) !== null
}

const matches = (shortcut: Shortcut, event: KeyboardEvent): boolean =>
  shortcut.key.toLowerCase() === event.key.toLowerCase() &&
  Boolean(shortcut.mod) === (event.metaKey || event.ctrlKey) &&
  Boolean(shortcut.shift) === event.shiftKey

export const useKeyboardShortcuts = (shortcuts: readonly Shortcut[]): void => {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return
      const shortcut = shortcuts.find((candidate) => matches(candidate, event))
      if (!shortcut) return
      event.preventDefault()
      shortcut.run()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [shortcuts])
}
