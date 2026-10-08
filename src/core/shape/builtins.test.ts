import { SHAPE_SAMPLE_COUNT } from '../ranges'
import type { ShapePath, Vec2 } from '../types'
import { BUILT_IN_SHAPES, findShape } from './builtins'
import { analyze, normalize, reconstruct, resample } from './spectrum'

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
/** 单向 Hausdorff 距离: a 中每个点到 b 的最近距离的最大值 */
const hausdorff = (a: ShapePath, b: ShapePath) =>
  Math.max(...a.map((p) => Math.min(...b.map((q) => distance(p, q)))))
const extentOf = (path: ShapePath) => {
  const xs = path.map((p) => p.x)
  const ys = path.map((p) => p.y)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}
const rotate = (path: ShapePath, degrees: number): ShapePath => {
  const a = (degrees * Math.PI) / 180
  return path.map((p) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }))
}

describe('BUILT_IN_SHAPES', () => {
  test('offers eight named shapes including the snowflake', () => {
    expect(BUILT_IN_SHAPES).toHaveLength(8)
    expect(BUILT_IN_SHAPES.map((s) => s.id)).toEqual([
      'snowflake', 'star', 'heart', 'circle', 'triangle', 'square', 'hexagon', 'letterF',
    ])
    expect(BUILT_IN_SHAPES.every((s) => s.name.length > 0)).toBe(true)
    expect(findShape('snowflake')?.name).toBe('雪花')
  })

  test.each(BUILT_IN_SHAPES.map((s) => [s.id, s] as const))('%s is a valid closed path with a sane default count', (_, shape) => {
    const path = shape.path()
    expect(path.length).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < path.length; i++) {
      expect(distance(path[i] as Vec2, path[(i + 1) % path.length] as Vec2)).toBeGreaterThan(1e-9)
    }
    expect(shape.defaultCount).toBeGreaterThanOrEqual(2)
    expect(shape.defaultCount).toBeLessThanOrEqual(200)
  })

  test('the snowflake has 60° rotational symmetry and the letter F has none', () => {
    const snow = normalize(resample(findShape('snowflake')?.path() ?? [], 1200))
    expect(hausdorff(rotate(snow, 60), snow)).toBeLessThan(1e-6)
    const f = normalize(resample(findShape('letterF')?.path() ?? [], 600))
    for (const degrees of [90, 180, 270]) expect(hausdorff(rotate(f, degrees), f)).toBeGreaterThan(0.2)
    const mirrored = f.map((p) => ({ x: -p.x, y: p.y }))
    expect(hausdorff(mirrored, f)).toBeGreaterThan(0.2)
  })

  test.each(BUILT_IN_SHAPES.map((s) => [s.id, s] as const))(
    '%s is reproduced within 1% by 200 terms and 3% by 60 terms',
    (_, shape) => {
      const target = normalize(resample(shape.path(), SHAPE_SAMPLE_COUNT))
      const spectrum = analyze(target)
      const extent = extentOf(target)
      expect(hausdorff(reconstruct(spectrum, 200, SHAPE_SAMPLE_COUNT), target) / extent).toBeLessThan(0.01)
      expect(hausdorff(reconstruct(spectrum, 60, SHAPE_SAMPLE_COUNT), target) / extent).toBeLessThan(0.03)
    },
  )

  test('the heart keeps its point at the bottom (world coordinates, y up)', () => {
    const heart = normalize(resample(findShape('heart')?.path() ?? [], 400))
    const lowest = heart.reduce((min, p) => (p.y < min.y ? p : min))
    expect(Math.abs(lowest.x)).toBeLessThan(0.05)
    const widthAtTop = heart.filter((p) => p.y > 0.5).length
    const widthAtBottom = heart.filter((p) => p.y < -0.5).length
    expect(widthAtTop).toBeGreaterThan(widthAtBottom)
  })
})
