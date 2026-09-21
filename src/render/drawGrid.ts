import type { RenderTheme } from './theme'
import type { Region, Viewport } from './viewport'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const TARGET_SPACING_PX = 44
const MAJOR_EVERY = 5

/** 取 1/2/5 × 10ⁿ 中不小于 raw 的最小"整"步长 */
export const niceStep = (raw: number): number => {
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  if (fraction <= 1) return power
  if (fraction <= 2) return 2 * power
  if (fraction <= 5) return 5 * power
  return 10 * power
}

const line = (ctx: Ctx2D, x1: number, y1: number, x2: number, y2: number): void => {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

/** 示波器刻度: 细网格 + 每 5 格一条主刻度线 + 坐标轴 */
export const drawGrid = (
  ctx: Ctx2D,
  region: Region,
  viewport: Viewport,
  theme: RenderTheme,
  verticals = true,
): void => {
  const step = niceStep(TARGET_SPACING_PX / viewport.scale)
  const topLeft = viewport.toWorld({ x: region.x, y: region.y })
  const bottomRight = viewport.toWorld({ x: region.x + region.width, y: region.y + region.height })
  ctx.lineWidth = 1

  for (let i = Math.ceil(topLeft.x / step); verticals && i * step <= bottomRight.x; i++) {
    const x = Math.round(viewport.toScreen({ x: i * step, y: 0 }).x) + 0.5
    ctx.strokeStyle = i === 0 ? theme.axis : i % MAJOR_EVERY === 0 ? theme.gridMajor : theme.grid
    line(ctx, x, region.y, x, region.y + region.height)
  }
  for (let j = Math.ceil(bottomRight.y / step); j * step <= topLeft.y; j++) {
    const y = Math.round(viewport.toScreen({ x: 0, y: j * step }).y) + 0.5
    ctx.strokeStyle = j === 0 ? theme.axis : j % MAJOR_EVERY === 0 ? theme.gridMajor : theme.grid
    line(ctx, region.x, y, region.x + region.width, y)
  }
}
