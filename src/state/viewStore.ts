import { create } from 'zustand'
import { DEFAULT_TRAIL_SECONDS } from '../core/ranges'
import type { Vec2, ViewSettings } from '../core/types'

export type DisplayToggle = 'showVectors' | 'showCircles' | 'showTrail' | 'showGrid'

export const INITIAL_VIEW: ViewSettings = {
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: true,
  trailSeconds: DEFAULT_TRAIL_SECONDS,
  highlightedComponentId: null,
  selectedComponentId: null,
}

interface ViewActions {
  /** 悬停产生的临时高亮; 不覆盖用户用按钮固定的高亮 */
  readonly hoveredComponentId: string | null
  readonly hover: (componentId: string | null) => void
  readonly toggle: (key: DisplayToggle) => void
  readonly setZoomPan: (zoom: number, pan: Vec2) => void
  readonly fitView: () => void
  readonly setTrailSeconds: (seconds: number) => void
  readonly highlight: (componentId: string | null) => void
  readonly select: (componentId: string | null) => void
  readonly restore: (view: ViewSettings) => void
}

export const useViewStore = create<ViewSettings & ViewActions>()((set) => ({
  ...INITIAL_VIEW,
  hoveredComponentId: null,
  hover: (hoveredComponentId) => set({ hoveredComponentId }),
  toggle: (key) => set((state) => ({ [key]: !state[key] })),
  setZoomPan: (zoom, pan) => set({ zoom, pan }),
  fitView: () => set({ zoom: 'auto', pan: { x: 0, y: 0 } }),
  setTrailSeconds: (trailSeconds) => set({ trailSeconds }),
  highlight: (highlightedComponentId) => set({ highlightedComponentId }),
  select: (selectedComponentId) => set({ selectedComponentId }),
  restore: (view) => set(view),
}))

export const selectViewSettings = (
  state: ViewSettings & { readonly hoveredComponentId?: string | null },
): ViewSettings => ({
  zoom: state.zoom,
  pan: state.pan,
  showVectors: state.showVectors,
  showCircles: state.showCircles,
  showTrail: state.showTrail,
  showGrid: state.showGrid,
  trailSeconds: state.trailSeconds,
  highlightedComponentId: state.highlightedComponentId ?? state.hoveredComponentId ?? null,
  selectedComponentId: state.selectedComponentId,
})
