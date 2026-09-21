import { ZOOM_RANGE } from '../core/ranges'
import type { Vec2, ViewSettings } from '../core/types'

export interface Region {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Viewport {
  readonly scale: number
  readonly toScreen: (world: Vec2) => Vec2
  readonly toWorld: (screen: Vec2) => Vec2
}

const FIT_MARGIN = 1.1
const FALLBACK_RADIUS = 1

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const createViewport = (
  view: Pick<ViewSettings, 'zoom' | 'pan'>,
  boundingRadius: number,
  region: Region,
): Viewport => {
  const radius = boundingRadius > 0 ? boundingRadius : FALLBACK_RADIUS
  const fitScale = Math.min(region.width, region.height) / 2 / (radius * FIT_MARGIN)
  const zoom = view.zoom === 'auto' ? 1 : clamp(view.zoom, ZOOM_RANGE.min, ZOOM_RANGE.max)
  const pan = view.zoom === 'auto' ? { x: 0, y: 0 } : view.pan
  const scale = fitScale * zoom
  const centreX = region.x + region.width / 2
  const centreY = region.y + region.height / 2

  return {
    scale,
    toScreen: (world) => ({
      x: centreX + (world.x - pan.x) * scale,
      y: centreY - (world.y - pan.y) * scale,
    }),
    toWorld: (screen) => ({
      x: (screen.x - centreX) / scale + pan.x,
      y: (centreY - screen.y) / scale + pan.y,
    }),
  }
}
