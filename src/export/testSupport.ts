import { createDefaultFunction } from '../core/function'
import type { ViewSettings } from '../core/types'
import { FALLBACK_THEME } from '../render/theme'
import { createFakeContext } from '../test/fakeContext'
import type { ExportSurface, SurfaceFactory } from './surface'
import type { FrameInput } from './exportImage'

export const view: ViewSettings = {
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: true,
  trailSeconds: 8,
  highlightedComponentId: null,
  selectedComponentId: null,
}

export const frameInput: FrameInput = {
  fn: createDefaultFunction(),
  t: 1.25,
  view,
  size: { width: 640, height: 360 },
  theme: FALLBACK_THEME,
}

export interface FakeSurfaces {
  readonly factory: SurfaceFactory
  readonly created: {
    readonly width: number
    readonly height: number
    readonly surface: ExportSurface
  }[]
}

export const createFakeSurfaces = (toPng: ExportSurface['toPng']): FakeSurfaces => {
  const created: FakeSurfaces['created'] = []
  const factory: SurfaceFactory = (width, height) => {
    const surface: ExportSurface = {
      canvas: { width, height } as HTMLCanvasElement,
      ctx: createFakeContext().ctx,
      toPng,
    }
    created.push({ width, height, surface })
    return surface
  }
  return { factory, created }
}
