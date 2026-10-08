import fc from 'fast-check'
import type { Vec2 } from '../types'
import { parsePathData } from './pathData'

const unwrap = (d: string): readonly Vec2[] => {
  const result = parsePathData(d)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const close = (a: Vec2, b: Vec2, tolerance = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) < tolerance
const last = (pts: readonly Vec2[]) => pts[pts.length - 1] as Vec2

describe('parsePathData: commands', () => {
  test('M/L/H/V absolute and relative, with implicit repeats', () => {
    expect(unwrap('M 1 2 L 3 4 H 5 V 6')).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ])
    expect(unwrap('m 1 2 l 1 1 h 2 v 3')).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 6 },
    ])
    expect(unwrap('M 0 0 1 1 2 2')).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(unwrap('M0,0L10-5')).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: -5 },
    ])
  })

  test('Z closes back to the subpath start, and the subpath with the longest perimeter is returned', () => {
    const pts = unwrap('M 0 0 L 1 0 L 1 1 Z M 10 10 L 20 10 L 20 20 L 10 20 Z')
    expect(pts[0]).toEqual({ x: 10, y: 10 })
    expect(pts).toHaveLength(4)
  })

  test('cubic, smooth cubic, quadratic and smooth quadratic curves land on the analytic curve', () => {
    const pts = unwrap('M 0 0 C 0 10, 10 10, 10 0 S 20 -10, 20 0 Q 25 5, 30 0 T 40 0')
    expect(pts.length).toBeGreaterThan(40)
    // C 段中点: (0,0),(0,10),(10,10),(10,0) 在 t=0.5 处为 (5, 7.5)
    expect(pts.some((p) => close(p, { x: 5, y: 7.5 }, 0.3))).toBe(true)
    // Q 段中点: (20,0),(25,5),(30,0) 在 t=0.5 处为 (25, 2.5)
    expect(pts.some((p) => close(p, { x: 25, y: 2.5 }, 0.3))).toBe(true)
    expect(close(last(pts), { x: 40, y: 0 })).toBe(true)
  })

  test('arcs are flattened onto the circle and end at the target point', () => {
    const pts = unwrap('M 0 0 A 10 10 0 0 1 20 0')
    expect(close(last(pts), { x: 20, y: 0 })).toBe(true)
    const interior = pts.slice(1, -1)
    expect(interior.length).toBeGreaterThan(10)
    for (const p of interior) expect(Math.abs(Math.hypot(p.x - 10, p.y) - 10)).toBeLessThan(1e-6)
    // SVG 的 y 向下: sweep=1 从 (0,0) 到 (20,0) 走屏幕上的上方, 即 y < 0
    expect(interior.every((p) => p.y < 0)).toBe(true)
  })

  test('scientific notation and compact syntax are accepted', () => {
    expect(unwrap('M1e1 2E0L3e-1.5')).toEqual([
      { x: 10, y: 2 },
      { x: 0.3, y: 0.5 },
    ])
  })
})

describe('parsePathData: hostile input never throws', () => {
  test.each([
    'M 1',
    'X 0 0',
    'M 0 0 L 1e999 1',
    '',
    'M 0 0 L',
    'M 0 0 C 1 2 3',
    'M 0 0 A 1 1 0 2 0 1 1',
    'L 1 1',
    '1'.repeat(100_000),
  ])('returns an error for %j', (d) => {
    const result = parsePathData(d)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DATA_CORRUPT')
  })

  test('random strings produce a Result, never an exception (property)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (d) => {
        expect(() => parsePathData(d)).not.toThrow()
      }),
      { numRuns: 300 },
    )
  })

  test('a single point or a degenerate path is rejected', () => {
    expect(parsePathData('M 1 1').ok).toBe(false)
    expect(parsePathData('M 1 1 L 1 1').ok).toBe(false)
  })
})

describe('parsePathData: less common branches', () => {
  test('a zero-radius arc degenerates to a straight line to the end point', () => {
    expect(unwrap('M 0 0 A 0 5 0 0 1 10 0')).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
  })

  test('an arc whose radii are too small is scaled up to fit (SVG rule)', () => {
    const pts = unwrap('M 0 0 A 1 1 0 0 1 20 0')
    expect(close(last(pts), { x: 20, y: 0 })).toBe(true)
    // 半径被放大到 10, 弧为半圆, 中点距离端点连线 10
    expect(Math.max(...pts.map((p) => Math.abs(p.y)))).toBeCloseTo(10, 3)
  })

  test('the large-arc flag picks the long way round', () => {
    const short = unwrap('M 0 0 A 10 10 0 0 1 10 10')
    const long = unwrap('M 0 0 A 10 10 0 1 1 10 10')
    expect(long.length).toBeGreaterThan(short.length * 2)
    expect(close(last(long), { x: 10, y: 10 })).toBe(true)
  })

  test('S and T without a preceding curve reflect the current point', () => {
    const s = unwrap('M 0 0 S 10 10, 20 0')
    expect(close(last(s), { x: 20, y: 0 })).toBe(true)
    const t = unwrap('M 0 0 T 20 0')
    // 控制点退化为起点: 曲线就是直线
    expect(t.every((p) => Math.abs(p.y) < 1e-9)).toBe(true)
  })

  test('a relative m after a subpath starts from the current point; rotated arcs are accepted', () => {
    const pts = unwrap('M 0 0 L 10 0 L 10 10 Z m 100 100 l 50 0 l 0 50 z')
    // Z 之后当前点回到子路径起点 (0,0), 相对 m 从那里出发
    expect(pts[0]).toEqual({ x: 100, y: 100 })
    const rotated = unwrap('M 0 0 A 10 5 45 0 0 10 10')
    expect(close(last(rotated), { x: 10, y: 10 })).toBe(true)
  })
})

describe('parsePathData: numerically hostile arcs (review finding)', () => {
  test('an arc whose radius underflows still returns a Result and keeps its end point', () => {
    const result = parsePathData('M 0 0 A 1e-200 1e-200 0 0 1 10 10 l 5 5 Z')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.some((p) => close(p, { x: 10, y: 10 }))).toBe(true)
      expect(close(last(result.value), { x: 15, y: 15 })).toBe(true)
    }
  })

  test.each([
    ['半径下溢: rx² 为 0, 放大后 rx 变成无穷', 'M 0 0 A 1e-200 1e-200 0 0 1 10 10 l 5 5', 15],
    ['ry 放大后溢出为无穷, rx 仍有限', 'M 0 0 A 1 1e308 0 0 1 10 10 l 5 5', 15],
    ['半径过大: rx²·ry² 溢出, num/den 变成 NaN', 'M 0 0 A 1e200 1e200 0 0 1 10 10 l 5 5', 15],
    ['起点与终点重合且半径下溢: 0/0', 'M 0 0 A 1e-200 1e-200 0 0 1 0 0 l 5 5', 5],
  ])('%s → 退化为直线到终点', (_, d, end) => {
    const result = parsePathData(d)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
      expect(close(last(result.value), { x: end, y: end })).toBe(true)
    }
  })

  test('arcs with absurd radii, rotations and flags never produce non-finite points (property)', () => {
    const PROPERTY_RUNS = Number(process.env.ARC_PROPERTY_RUNS ?? 300)
    fc.assert(
      fc.property(
        fc.double({ min: -1e300, max: 1e300, noNaN: true }),
        fc.double({ min: -1e300, max: 1e300, noNaN: true }),
        fc.double({ min: -720, max: 720, noNaN: true }),
        fc.constantFrom(0, 1),
        fc.constantFrom(0, 1),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (rx, ry, rotation, large, sweep, x, y) => {
          const result = parsePathData(
            `M 0 0 A ${rx} ${ry} ${rotation} ${large} ${sweep} ${x} ${y} l 1 1`,
          )
          expect(result.ok).toBe(true)
          if (result.ok)
            expect(result.value.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(
              true,
            )
        },
      ),
      { numRuns: PROPERTY_RUNS },
    )
  })
})
