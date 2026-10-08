import fc from 'fast-check'
import heartStroke from '../../../tests/fixtures/strokes/heart.json'
import { DRAW_MIN_POINTS, DRAW_RESAMPLE_COUNT } from '../ranges'
import type { ShapePath, Vec2 } from '../types'
import { closeStroke, selfIntersections, smooth, strokeToPath } from './drawing'
import { normalize, resample } from './spectrum'

const raw = (heartStroke as number[][]).map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 }))
const shortSide = 600
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
const centroid = (p: ShapePath) => p.reduce((acc, q) => ({ x: acc.x + q.x / p.length, y: acc.y + q.y / p.length }), { x: 0, y: 0 })
const figureEight = (n: number): ShapePath =>
  Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n
    return { x: 100 * Math.sin(t), y: 60 * Math.sin(2 * t) }
  })

describe('closeStroke', () => {
  test('rejects a stroke with too few points and says to draw longer', () => {
    const result = closeStroke(raw.slice(0, DRAW_MIN_POINTS - 1), shortSide)
    expect(result.ok === false && result.error.message).toContain('再画长一些')
  })

  test('rejects a stroke that is too short relative to the canvas', () => {
    const tiny = Array.from({ length: 50 }, (_, i) => ({ x: 300 + i * 0.1, y: 300 }))
    expect(closeStroke(tiny, shortSide).ok).toBe(false)
  })

  test('accepts a real stroke and drops duplicate neighbours', () => {
    const withDuplicates = [...raw.slice(0, 100), ...raw.slice(99, 100), ...raw.slice(100)]
    const result = closeStroke(withDuplicates, shortSide)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.length).toBeLessThan(withDuplicates.length)
      for (let i = 0; i < result.value.length; i++) {
        expect(distance(result.value[i] as Vec2, result.value[(i + 1) % result.value.length] as Vec2)).toBeGreaterThan(0)
      }
    }
  })
})

describe('smooth', () => {
  const path = resample(raw, DRAW_RESAMPLE_COUNT)

  test('zero smoothing returns the very same path', () => {
    expect(smooth(path, 0)).toBe(path)
  })

  test('keeps the point count and the centroid, and reduces jitter', () => {
    const out = smooth(path, 50)
    expect(out).toHaveLength(path.length)
    const before = centroid(path)
    const after = centroid(out)
    expect(distance(before, after)).toBeLessThan(1e-9)
    const roughness = (p: ShapePath) =>
      p.reduce((sum, q, i) => {
        const prev = p[(i - 1 + p.length) % p.length] as Vec2
        const next = p[(i + 1) % p.length] as Vec2
        return sum + Math.hypot(prev.x + next.x - 2 * q.x, prev.y + next.y - 2 * q.y)
      }, 0)
    expect(roughness(out)).toBeLessThan(roughness(path) * 0.5)
  })

  test('does not change the topology: a figure eight keeps its crossing', () => {
    const eight = resample(figureEight(200), DRAW_RESAMPLE_COUNT)
    expect(selfIntersections(eight)).toBe(selfIntersections(smooth(eight, 100)))
    expect(selfIntersections(eight)).toBeGreaterThan(0)
  })

  test('is a closed-path operation: centroid preserved for random paths (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ x: fc.double({ min: -5, max: 5, noNaN: true }), y: fc.double({ min: -5, max: 5, noNaN: true }) }), { minLength: 8, maxLength: 60 }),
        fc.integer({ min: 0, max: 100 }),
        (pts, smoothing) => {
          const out = smooth(pts, smoothing)
          expect(out).toHaveLength(pts.length)
          expect(distance(centroid(pts), centroid(out))).toBeLessThan(1e-9)
        },
      ),
      { numRuns: 60 },
    )
  })
})

describe('strokeToPath', () => {
  test('flips screen y into world y: the heart drawn on screen comes out point-down', () => {
    const result = strokeToPath(raw, 0, shortSide)
    if (!result.ok) throw new Error('expected ok')
    const path = normalize(result.value)
    const lowest = path.reduce((min, p) => (p.y < min.y ? p : min))
    expect(Math.abs(lowest.x)).toBeLessThan(0.1)
  })

  test('is insensitive to how fast the stroke was drawn (point density)', () => {
    const dense = strokeToPath(raw, 25, shortSide)
    const sparse = strokeToPath(raw.filter((_, i) => i % 3 === 0), 25, shortSide)
    if (!dense.ok || !sparse.ok) throw new Error('expected ok')
    const a = normalize(dense.value)
    const b = normalize(sparse.value)
    a.forEach((p, i) => expect(distance(p, b[i] as Vec2)).toBeLessThan(0.02 * 2))
  })
})

describe('closeStroke seams', () => {
  test('drops a final point that repeats the first, so the closing edge is not duplicated', () => {
    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 90, y: i * 10 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 90 - i * 10, y: 90 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 90 - i * 10 })),
    ]
    const plain = closeStroke(square, 600)
    const withSeam = closeStroke([...square, { x: 0, y: 0 }], 600)
    expect(plain.ok && withSeam.ok && withSeam.value.length).toBe(plain.ok && plain.value.length)
  })
})
