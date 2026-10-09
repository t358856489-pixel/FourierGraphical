import { create } from 'zustand'
import type { CopyFormat, Notation } from '../core/expression/types'
import type { PresentationMode } from '../core/types'

/** 表达式视图的会话偏好 (specs/004 FR-003 / FR-012 / FR-015): 不持久化, 刷新后回到默认 */
export interface ExpressionPrefs {
  readonly isOpen: boolean
  /** null = 跟随呈现模式 */
  readonly notation: Notation | null
  readonly format: CopyFormat
}

interface ExpressionActions {
  readonly toggleOpen: () => void
  readonly setNotation: (notation: Notation) => void
  readonly setFormat: (format: CopyFormat) => void
  readonly reset: () => void
}

const INITIAL: ExpressionPrefs = { isOpen: false, notation: null, format: 'plain' }

export const defaultNotation = (mode: PresentationMode): Notation =>
  mode === 'drawing2d' ? 'complex' : 'waveform'

export const effectiveNotation = (
  prefs: Pick<ExpressionPrefs, 'notation'>,
  mode: PresentationMode,
): Notation => prefs.notation ?? defaultNotation(mode)

export const useExpressionStore = create<ExpressionPrefs & ExpressionActions>()((set) => ({
  ...INITIAL,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setNotation: (notation) => set({ notation }),
  setFormat: (format) => set({ format }),
  reset: () => set(INITIAL),
}))
