import {
  DRAW_MAX_SMOOTH_HALF_WINDOW,
  DRAW_MIN_EXTENT_RATIO,
  DRAW_MIN_POINTS,
  DRAW_RESAMPLE_COUNT,
} from '../ranges'
import { err, ok, type Result, type ShapePath, type Vec2 } from '../types'
import { resample } from './spectrum'

/** 笔迹是屏幕像素: 1 px 以内的点是抖动与重复, 它们只会虚增弧长 */
const DUPLICATE_DISTANCE = 1
const TOO_SHORT = '这一笔太短了, 请再画长一些'

const pathLength = (path: ShapePath): number =>
  path.reduce((sum, p, i) => {
    const q = path[(i + 1) % path.length] as Vec2
    return sum + Math.hypot(q.x - p.x, q.y - p.y)
  }, 0)

/** 去掉相邻重复点并闭合; 太短的一笔拒绝 (FR-013). 输入为屏幕像素坐标 */
export const closeStroke = (points: readonly Vec2[], canvasShortSide: number): Result<ShapePath> => {
  // 与最近一个保留下来的点比较(不是原序列的前一个点), 否则密集的一段会被整段删掉
  const cleaned = points.reduce<Vec2[]>((kept, p) => {
    const prev = kept[kept.length - 1]
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > DUPLICATE_DISTANCE) kept.push(p)
    return kept
  }, [])
  if (cleaned.length < DRAW_MIN_POINTS) return err('OUT_OF_RANGE', TOO_SHORT)
  // 首尾重合时去掉末点, 闭合由"末点连回首点"的约定承担
  const first = cleaned[0] as Vec2
  const last = cleaned[cleaned.length - 1] as Vec2
  const closed = Math.hypot(last.x - first.x, last.y - first.y) <= DUPLICATE_DISTANCE ? cleaned.slice(0, -1) : cleaned
  if (pathLength(closed) < canvasShortSide * DRAW_MIN_EXTENT_RATIO) return err('OUT_OF_RANGE', TOO_SHORT)
  return ok(closed)
}

/**
 * 循环移动平均 (FR-014a): smoothing 0–100 → 半窗 0–DRAW_MAX_SMOOTH_HALF_WINDOW.
 * 线性滤波保持重心; 只缩小抖动, 不会消除自相交(拓扑不变).
 */
export const smooth = (path: ShapePath, smoothing: number): ShapePath => {
  const half = Math.round((Math.min(100, Math.max(0, smoothing)) / 100) * DRAW_MAX_SMOOTH_HALF_WINDOW)
  if (half === 0 || path.length < 3) return path
  const n = path.length
  return path.map((_, i) => {
    let x = 0
    let y = 0
    for (let k = -half; k <= half; k++) {
      const p = path[(((i + k) % n) + n) % n] as Vec2
      x += p.x
      y += p.y
    }
    const width = 2 * half + 1
    return { x: x / width, y: y / width }
  })
}

const orientation = (a: Vec2, b: Vec2, c: Vec2): number =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))

const segmentsCross = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean =>
  orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0

/** 闭合折线的自相交次数(不含相邻边); 用于验证平滑不改变拓扑 */
export const selfIntersections = (path: ShapePath): number => {
  const n = path.length
  let count = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const a = path[i] as Vec2
      const b = path[(i + 1) % n] as Vec2
      const c = path[j] as Vec2
      const d = path[(j + 1) % n] as Vec2
      if (segmentsCross(a, b, c, d)) count += 1
    }
  }
  return count
}

/**
 * 原始笔迹(屏幕像素, y 向下) → 可供转换的路径(世界坐标, y 向上): 去重闭合 → 等弧长重采样 → 平滑 → 翻转 y.
 * 不做缩放与平移: normalize 会重新居中并缩放, 只有方向重要 (research R5, 修订 F2)
 */
export const strokeToPath = (
  points: readonly Vec2[],
  smoothing: number,
  canvasShortSide: number,
): Result<ShapePath> => {
  const closed = closeStroke(points, canvasShortSide)
  if (!closed.ok) return closed
  return ok(smooth(resample(closed.value, DRAW_RESAMPLE_COUNT), smoothing).map((p) => ({ x: p.x, y: -p.y })))
}
