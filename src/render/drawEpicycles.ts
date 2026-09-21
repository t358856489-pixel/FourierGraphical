import type { VectorLink } from '../core/evaluator'
import type { ViewSettings } from '../core/types'
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
