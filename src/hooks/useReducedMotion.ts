import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const subscribe = (onChange: () => void): (() => void) => {
  const media = window.matchMedia?.(QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

export const prefersReducedMotion = (): boolean => window.matchMedia?.(QUERY).matches ?? false

export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
