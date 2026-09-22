import { mix, parseColor, toHex } from '../core/color'
import type { VectorLink } from '../core/evaluator'
import { HIGHLIGHT_BANDS, SMOOTH_BELOW_SAMPLES_PER_TURN } from '../core/ranges'
import type { TrailPlan, ViewSettings } from '../core/types'
import type { Ctx2D } from './drawGrid'
import { componentColor, type RenderTheme } from './theme'
import type { Viewport } from './viewport'

const TAU = Math.PI * 2
const FADE_BANDS = 24
const DIMMED_ALPHA = 0.3
const TIP_RADIUS_PX = 3.5

const alphaFor = (link: VectorLink, highlightedId: string | null): number =>
  highlightedId === null || link.componentId === highlightedId ? 1 : DIMMED_ALPHA

export const drawCircles = (
  ctx: Ctx2D,
  chain: readonly VectorLink[],
  viewport: Viewport,
  view: ViewSettings,
  theme: RenderTheme,
): void => {
  ctx.lineWidth = 1
  for (const link of chain) {
    const centre = viewport.toScreen(link.from)
    ctx.globalAlpha = 0.55 * alphaFor(link, view.highlightedComponentId)
    ctx.strokeStyle = componentColor(theme, link.color)
    ctx.beginPath()
    ctx.arc(centre.x, centre.y, link.radius * viewport.scale, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export const drawVectors = (
  ctx: Ctx2D,
  chain: readonly VectorLink[],
  viewport: Viewport,
  view: ViewSettings,
  theme: RenderTheme,
): void => {
  for (const link of chain) {
    const from = viewport.toScreen(link.from)
    const to = viewport.toScreen(link.to)
    ctx.globalAlpha = alphaFor(link, view.highlightedComponentId)
    ctx.lineWidth = link.componentId === view.highlightedComponentId ? 3 : 1.75
    ctx.strokeStyle = componentColor(theme, link.color)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** 按时间先后分段提高不透明度, 形成荧光屏余辉式的渐隐 */
export const drawFadingPolyline = (
  ctx: Ctx2D,
  pointCount: number,
  pointAt: (index: number) => { x: number; y: number },
  color: string,
): void => {
  if (pointCount < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  const bandSize = Math.max(1, Math.ceil((pointCount - 1) / FADE_BANDS))
  for (let start = 0; start < pointCount - 1; start += bandSize) {
    const end = Math.min(pointCount - 1, start + bandSize)
    ctx.globalAlpha = Math.max(0.04, (end / (pointCount - 1)) ** 1.6)
    ctx.beginPath()
    const first = pointAt(start)
    ctx.moveTo(first.x, first.y)
    for (let i = start + 1; i <= end; i++) {
      const point = pointAt(i)
      ctx.lineTo(point.x, point.y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export const drawTrail = (
  ctx: Ctx2D,
  trail: Float64Array,
  viewport: Viewport,
  theme: RenderTheme,
): void =>
  drawFadingPolyline(
    ctx,
    trail.length / 3,
    (index) =>
      viewport.toScreen({ x: trail[index * 3 + 1] as number, y: trail[index * 3 + 2] as number }),
    theme.trace,
  )

export const drawRetainedTrail = (
  ctx: Ctx2D,
  trail: Float64Array,
  plan: TrailPlan,
  viewport: Viewport,
  theme: RenderTheme,
): void =>
  drawRetainedPolyline(
    ctx,
    trail.length / 3,
    (index) =>
      viewport.toScreen({ x: trail[index * 3 + 1] as number, y: trail[index * 3 + 2] as number }),
    (index) => trail[index * 3] as number,
    plan,
    theme,
  )

export const drawTip = (
  ctx: Ctx2D,
  chain: readonly VectorLink[],
  viewport: Viewport,
  theme: RenderTheme,
): void => {
  const last = chain.at(-1)
  if (!last) return
  const tip = viewport.toScreen(last.to)
  ctx.fillStyle = theme.trace
  ctx.beginPath()
  ctx.arc(tip.x, tip.y, TIP_RADIUS_PX, 0, TAU)
  ctx.fill()
}

type Point = { readonly x: number; readonly y: number }

const bandColorCache = new WeakMap<RenderTheme, readonly string[]>()

/** 高亮各段的颜色: 从正常亮度单调过渡到完整的轨迹色; 全部不透明 */
const bandColors = (theme: RenderTheme): readonly string[] => {
  const cached = bandColorCache.get(theme)
  if (cached) return cached
  const from = parseColor(theme.traceNormal)
  const to = parseColor(theme.trace)
  const colors = Array.from({ length: HIGHLIGHT_BANDS }, (_, band) =>
    from.ok && to.ok ? toHex(mix(from.value, to.value, (band + 1) / HIGHLIGHT_BANDS)) : theme.trace,
  )
  bandColorCache.set(theme, colors)
  return colors
}

/** 描 [first, last] 这一段; 采样稀疏时过相邻点的中点画二次曲线, 保持圆滑 */
const strokeRun = (
  ctx: Ctx2D,
  first: number,
  last: number,
  pointAt: (index: number) => Point,
  isSmooth: boolean,
): void => {
  if (last <= first) return
  ctx.beginPath()
  const start = pointAt(first)
  ctx.moveTo(start.x, start.y)
  for (let i = first + 1; i <= last; i++) {
    const point = pointAt(i)
    if (!isSmooth || i === last) {
      ctx.lineTo(point.x, point.y)
      continue
    }
    const next = pointAt(i + 1)
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2)
  }
  ctx.stroke()
}

/** 第一个 time > threshold 的下标(二分) */
const firstIndexAfter = (count: number, timeAt: (index: number) => number, threshold: number): number => {
  let low = 0
  let high = count
  while (low < high) {
    const mid = (low + high) >> 1
    if (timeAt(mid) <= threshold) low = mid + 1
    else high = mid
  }
  return low
}

/**
 * 保留模式的轨迹 (功能 002 FR-002b): 旧的部分一律用不透明的"正常亮度", 最新一段分段变亮.
 * 不用 globalAlpha: 保留的轨迹会反复自相重叠, 半透明会越描越亮.
 */
export const drawRetainedPolyline = (
  ctx: Ctx2D,
  pointCount: number,
  pointAt: (index: number) => Point,
  timeAt: (index: number) => number,
  plan: TrailPlan,
  theme: RenderTheme,
): void => {
  if (pointCount < 2) return
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 1
  const isSmooth = plan.samplesPerTurn < SMOOTH_BELOW_SAMPLES_PER_TURN
  const last = pointCount - 1

  let from = Math.min(last, Math.max(0, firstIndexAfter(pointCount, timeAt, plan.highlightStart) - 1))
  ctx.strokeStyle = theme.traceNormal
  strokeRun(ctx, 0, from, pointAt, isSmooth)

  const span = plan.end - plan.highlightStart
  bandColors(theme).forEach((color, band) => {
    const until = plan.highlightStart + (span * (band + 1)) / HIGHLIGHT_BANDS
    const to = band === HIGHLIGHT_BANDS - 1 ? last : Math.min(last, firstIndexAfter(pointCount, timeAt, until) - 1)
    ctx.strokeStyle = color
    strokeRun(ctx, from, Math.max(from, to), pointAt, isSmooth)
    from = Math.max(from, to)
  })
}
