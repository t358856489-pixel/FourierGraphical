import type { ShapePath, Vec2 } from '../types'

export type BuiltInShapeId =
  | 'snowflake'
  | 'star'
  | 'heart'
  | 'circle'
  | 'triangle'
  | 'square'
  | 'hexagon'
  | 'letterF'

export interface BuiltInShape {
  readonly id: BuiltInShapeId
  readonly name: string
  /** 生成闭合路径(世界坐标, y 向上)的纯函数 */
  readonly path: () => ShapePath
  readonly defaultCount: number
}

const TAU = Math.PI * 2
const KOCH_DEPTH = 3
const STAR_INNER_RATIO = 0.382
const CIRCLE_POINTS = 256
const HEART_POINTS = 400

const regularPolygon = (sides: number, radius = 1, startDegrees = 90): ShapePath =>
  Array.from({ length: sides }, (_, i) => {
    const a = (startDegrees * Math.PI) / 180 + (TAU * i) / sides
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) }
  })

/** 把线段 a→b 换成 Koch 曲线的四段; 凸起朝外(多边形按逆时针给出) */
const kochSegment = (a: Vec2, b: Vec2, depth: number): Vec2[] => {
  if (depth === 0) return [a]
  const dx = (b.x - a.x) / 3
  const dy = (b.y - a.y) / 3
  const p1 = { x: a.x + dx, y: a.y + dy }
  const p3 = { x: a.x + 2 * dx, y: a.y + 2 * dy }
  const peak = {
    x: p1.x + dx * Math.cos(-Math.PI / 3) - dy * Math.sin(-Math.PI / 3),
    y: p1.y + dx * Math.sin(-Math.PI / 3) + dy * Math.cos(-Math.PI / 3),
  }
  return [a, p1, peak, p3].flatMap((from, i, pts) =>
    kochSegment(from, pts[i + 1] ?? b, depth - 1),
  )
}

const snowflake = (): ShapePath => {
  const triangle = regularPolygon(3)
  return triangle.flatMap((a, i) => kochSegment(a, triangle[(i + 1) % 3] as Vec2, KOCH_DEPTH))
}

const star = (): ShapePath =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : STAR_INNER_RATIO
    const a = Math.PI / 2 + (TAU * i) / 10
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })

/** 经典心形参数方程; 尖端在下方 */
const heart = (): ShapePath =>
  Array.from({ length: HEART_POINTS }, (_, i) => {
    const t = (TAU * i) / HEART_POINTS
    return {
      x: 16 * Math.sin(t) ** 3,
      y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
    }
  })

/** 字母 F: 无旋转与镜像对称, 便于看出描绘方向 */
const letterF = (): ShapePath => [
  { x: -0.5, y: -1 }, { x: -0.5, y: 1 }, { x: 0.6, y: 1 }, { x: 0.6, y: 0.7 },
  { x: -0.15, y: 0.7 }, { x: -0.15, y: 0.15 }, { x: 0.4, y: 0.15 }, { x: 0.4, y: -0.15 },
  { x: -0.15, y: -0.15 }, { x: -0.15, y: -1 },
]

export const BUILT_IN_SHAPES: readonly BuiltInShape[] = [
  { id: 'snowflake', name: '雪花', path: snowflake, defaultCount: 150 },
  { id: 'star', name: '五角星', path: star, defaultCount: 60 },
  { id: 'heart', name: '心形', path: heart, defaultCount: 40 },
  { id: 'circle', name: '圆', path: () => regularPolygon(CIRCLE_POINTS), defaultCount: 2 },
  { id: 'triangle', name: '正三角形', path: () => regularPolygon(3), defaultCount: 40 },
  { id: 'square', name: '正方形', path: () => regularPolygon(4, 1, 45), defaultCount: 40 },
  { id: 'hexagon', name: '正六边形', path: () => regularPolygon(6, 1, 0), defaultCount: 40 },
  { id: 'letterF', name: '字母 F', path: letterF, defaultCount: 80 },
]

export const findShape = (id: BuiltInShapeId): BuiltInShape | undefined =>
  BUILT_IN_SHAPES.find((shape) => shape.id === id)
