import type { TrailPlan, Vec2 } from '../core/types'
import { drawFadingPolyline, drawRetainedPolyline } from './drawEpicycles'
import type { Ctx2D } from './drawGrid'

const MAJOR_TICK_SECONDS = 5
import type { RenderTheme } from './theme'
import type { Region, Viewport } from './viewport'

/**
 * 波形视图: 横轴为"多久以前"(左端 = 此刻), 纵轴与本轮视图共用同一缩放,
 * 因此从本轮末端到波形起点的连接线恰好水平.
 */
export const drawWaveform = (
  ctx: Ctx2D,
  trail: Float64Array,
  t: number,
  windowSeconds: number,
  region: Region,
  viewport: Viewport,
  tip: Vec2 | null,
  theme: RenderTheme,
  showBaseline = true,
  plan?: TrailPlan,
): void => {
  const pixelsPerSecond = region.width / windowSeconds
  const count = trail.length / 3
  const pointAt = (index: number) => ({
    x: region.x + (t - (trail[index * 3] as number)) * pixelsPerSecond,
    y: viewport.toScreen({ x: 0, y: trail[index * 3 + 2] as number }).y,
  })

  // 零值基准线属于"坐标轴" (FR-010)
  if (showBaseline) {
    ctx.strokeStyle = theme.axis
    ctx.lineWidth = 1
    const baseline = Math.round(viewport.toScreen({ x: 0, y: 0 }).y) + 0.5
    ctx.beginPath()
    ctx.moveTo(region.x, baseline)
    ctx.lineTo(region.x + region.width, baseline)
    ctx.stroke()
  }

  if (plan?.mode === 'retained') {
    drawRetainedPolyline(ctx, count, pointAt, (index) => trail[index * 3] as number, plan, theme)
  } else {
    drawFadingPolyline(ctx, count, pointAt, theme.trace)
  }

  if (!tip) return
  const from = viewport.toScreen(tip)
  ctx.strokeStyle = theme.circle
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(region.x, from.y)
  ctx.stroke()
  ctx.setLineDash([])
}

/** 波形区的竖线是时间刻度: 每秒一条, 每 5 秒一条主刻度, 随时间向右流动 */
export const drawTimeTicks = (
  ctx: Ctx2D,
  t: number,
  windowSeconds: number,
  region: Region,
  theme: RenderTheme,
): void => {
  const pixelsPerSecond = region.width / windowSeconds
  ctx.lineWidth = 1
  for (let second = Math.ceil(Math.max(0, t - windowSeconds)); second <= t; second++) {
    const x = Math.round(region.x + (t - second) * pixelsPerSecond) + 0.5
    ctx.strokeStyle = second % MAJOR_TICK_SECONDS === 0 ? theme.gridMajor : theme.grid
    ctx.beginPath()
    ctx.moveTo(x, region.y)
    ctx.lineTo(x, region.y + region.height)
    ctx.stroke()
  }
}
