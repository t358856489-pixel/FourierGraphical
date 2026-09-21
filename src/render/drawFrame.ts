import { boundingRadius, sampleTrail, vectorChain } from '../core/evaluator'
import { DEFAULT_MAX_TRAIL_POINTS } from '../core/ranges'
import type { FourierFunction, PresentationMode, ViewSettings } from '../core/types'
import { drawCircles, drawTip, drawTrail, drawVectors } from './drawEpicycles'
import { drawGrid, type Ctx2D } from './drawGrid'
import { drawTimeTicks, drawWaveform } from './drawWaveform'
import type { RenderTheme } from './theme'
import { createViewport, type Region } from './viewport'

export interface FrameSize {
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
}

const EPICYCLE_SHARE = 0.42
const REGION_GAP = 12

export const layoutRegions = (
  mode: PresentationMode,
  size: Pick<FrameSize, 'width' | 'height'>,
): { readonly epicycles: Region; readonly waveform: Region | null } => {
  if (mode === 'drawing2d') {
    return { epicycles: { x: 0, y: 0, width: size.width, height: size.height }, waveform: null }
  }
  const epicycleWidth = Math.round(size.width * EPICYCLE_SHARE)
  return {
    epicycles: { x: 0, y: 0, width: epicycleWidth, height: size.height },
    waveform: {
      x: epicycleWidth + REGION_GAP,
      y: 0,
      width: size.width - epicycleWidth - REGION_GAP,
      height: size.height,
    },
  }
}

const clipTo = (ctx: Ctx2D, region: Region): void => {
  ctx.beginPath()
  ctx.rect(region.x, region.y, region.width, region.height)
  ctx.clip()
}

/**
 * 唯一的绘制入口: 实时画布、图片导出、视频导出共用 (章程原则 I).
 * 除 ctx 外无副作用; 相同入参产生相同画面.
 */
export const drawFrame = (
  ctx: Ctx2D,
  fn: FourierFunction,
  t: number,
  view: ViewSettings,
  size: FrameSize,
  theme: RenderTheme,
  presampledTrail?: Float64Array,
): void => {
  // 按整个像素缓冲清屏: CSS 尺寸可能是小数, 按它清屏会留下只被部分覆盖的边缘像素,
  // 与上一帧的残留混合, 破坏"相同入参产生相同画面"
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = theme.background
  ctx.fillRect(
    0,
    0,
    Math.ceil(size.width * size.pixelRatio),
    Math.ceil(size.height * size.pixelRatio),
  )
  ctx.setTransform(size.pixelRatio, 0, 0, size.pixelRatio, 0, 0)

  const regions = layoutRegions(fn.presentationMode, size)
  const viewport = createViewport(view, boundingRadius(fn), regions.epicycles)
  const chain = vectorChain(fn, t)
  const needsTrail = view.showTrail || regions.waveform !== null
  const trail = needsTrail
    ? (presampledTrail ?? sampleTrail(fn, t, view.trailSeconds, DEFAULT_MAX_TRAIL_POINTS))
    : new Float64Array(0)

  ctx.save()
  clipTo(ctx, regions.epicycles)
  if (view.showGrid) drawGrid(ctx, regions.epicycles, viewport, theme)
  if (view.showCircles) drawCircles(ctx, chain, viewport, view, theme)
  if (view.showTrail && regions.waveform === null) drawTrail(ctx, trail, viewport, theme)
  if (view.showVectors) drawVectors(ctx, chain, viewport, view, theme)
  drawTip(ctx, chain, viewport, theme)
  ctx.restore()

  if (!regions.waveform) return
  ctx.save()
  clipTo(ctx, regions.waveform)
  if (view.showGrid) {
    drawGrid(ctx, regions.waveform, viewport, theme, false)
    drawTimeTicks(ctx, t, view.trailSeconds, regions.waveform, theme)
  }
  ctx.restore()
  if (view.showTrail) {
    drawWaveform(
      ctx,
      trail,
      t,
      view.trailSeconds,
      regions.waveform,
      viewport,
      chain.at(-1)?.to ?? null,
      theme,
    )
  }
}
