import { create } from 'zustand'
import type { ParamName } from '../../core/types'

export interface KeyframeRef {
  readonly componentId: string
  readonly param: ParamName
  readonly time: number
}

interface SelectionState {
  readonly selected: KeyframeRef | null
  readonly select: (ref: KeyframeRef | null) => void
  /** 正在被指针拖动的关键帧. 放在组件之外: 拖动会改变时刻与顺序, 标记组件可能被复用或重建 */
  readonly dragging: KeyframeRef | null
  readonly setDragging: (ref: KeyframeRef | null) => void
}

export const useKeyframeSelection = create<SelectionState>()((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
  dragging: null,
  setDragging: (dragging) => set({ dragging }),
}))
