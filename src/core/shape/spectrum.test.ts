import fc from 'fast-check'
import { createDefaultFunction } from '../function'
import { FREQUENCY_RANGE, PRESET_BASE_FREQUENCY, SHAPE_MAX_HARMONIC, SHAPE_TARGET_EXTENT } from '../ranges'
import { fourierFunctionSchema } from '../schema'
import type { ShapePath, Vec2 } from '../types'
import { analyze, normalize, reconstruct, resample, toComponents } from './spectrum'

const circle = (n: number, r = 3, cx = 1, cy = -2): ShapePath =>
  Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / n),
    y: cy + r * Math.sin((2 * Math.PI * i) / n),
  }))
const polygon = (sides: number): ShapePath => circle(sides, 1, 0, 0)
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
const spacings = (path: ShapePath) => path.map((p, i) => distance(p, path[(i + 1) % path.length] as Vec2))

describe('resample', () => {
  test('produces n equally spaced points along the closed path, starting at the first point', () => {
    const out = resample(polygon(4), 64)
    expect(out).toHaveLength(64)
    const gaps = spacings(out)
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.01)
    expect(out[0]).toEqual(polygon(4)[0])
  })

  test('is insensitive to the input point density', () => {
    const sparse = resample(circle(64), 128)
    const dense = resample(circle(1000), 128)
    // 64 边形偏离圆至多 r·(1 − cos(π/64)) ≈ 0.0036
    sparse.forEach((p, i) => expect(distance(p, dense[i] as Vec2)).toBeLessThan(0.01))
  })
})

describe('normalize', () => {
  test('centres on the centroid, scales the long side to the target extent and does not flip y', () => {
    const out = normalize(circle(64, 3, 1, -2))
    const mean = out.reduce((acc, p) => ({ x: acc.x + p.x / out.length, y: acc.y + p.y / out.length }), { x: 0, y: 0 })
    expect(Math.abs(mean.x)).toBeLessThan(1e-9)
    expect(Math.abs(mean.y)).toBeLessThan(1e-9)
    const xs = out.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(SHAPE_TARGET_EXTENT, 9)
    // 原图第一个点在圆的右侧(y = cy), 第 16 个点在顶部(y 最大): 归一化后仍在上方
    expect((out[16] as Vec2).y).toBeGreaterThan(0)
  })
})

describe('analyze', () => {
  test('a circle is a single term at n = ±1 with amplitude equal to the radius', () => {
    const spectrum = analyze(normalize(resample(circle(1024), 1024)))
    const [first, ...rest] = spectrum.terms
    expect(Math.abs(first?.n ?? 0)).toBe(1)
    expect(first?.amplitude).toBeCloseTo(SHAPE_TARGET_EXTENT / 2, 4)
    expect(Math.max(...rest.map((t) => t.amplitude))).toBeLessThan(1e-4)
    expect(spectrum.terms.some((t) => t.n === 0)).toBe(false)
  })

  test('a reversed circle rotates the other way', () => {
    const spectrum = analyze(normalize(resample([...circle(256)].reverse(), 256)))
    expect(spectrum.terms[0]?.n).toBe(-1)
  })

  test('a regular pentagon only has energy at n ≡ 1 (mod 5)', () => {
    const spectrum = analyze(normalize(resample(polygon(5), 1024)))
    for (const term of spectrum.terms) {
      if (term.amplitude > 1e-3) expect((((term.n - 1) % 5) + 5) % 5).toBe(0)
    }
  })

  test('terms are sorted by amplitude, descending, and never exceed the frequency range', () => {
    const spectrum = analyze(normalize(resample(polygon(7), 1024)))
    spectrum.terms.slice(1).forEach((t, i) => expect(t.amplitude).toBeLessThanOrEqual(spectrum.terms[i]?.amplitude ?? 0))
    for (const term of spectrum.terms) {
      expect(Math.abs(term.n)).toBeLessThanOrEqual(SHAPE_MAX_HARMONIC)
      expect(Math.abs(term.n * PRESET_BASE_FREQUENCY)).toBeLessThanOrEqual(FREQUENCY_RANGE.max)
    }
  })
})

describe('reconstruct', () => {
  const closedPathArb = fc
    .array(fc.record({ x: fc.double({ min: -5, max: 5, noNaN: true }), y: fc.double({ min: -5, max: 5, noNaN: true }) }), { minLength: 3, maxLength: 40 })
    .filter((pts) => spacings(pts).every((gap) => gap > 1e-3))

  test('using every term reproduces the normalised, resampled input (property)', () => {
    fc.assert(
      fc.property(closedPathArb, (path) => {
        const n = 256
        const target = normalize(resample(path, n))
        const spectrum = analyze(target)
        const rebuilt = reconstruct(spectrum, spectrum.terms.length, n)
        target.forEach((p, i) => expect(distance(p, rebuilt[i] as Vec2)).toBeLessThan(1e-6))
      }),
      { numRuns: 40 },
    )
  })

  test('a jagged path still yields only in-range harmonics (property)', () => {
    fc.assert(
      fc.property(closedPathArb, (path) => {
        const spectrum = analyze(normalize(resample(path, 2048)))
        expect(spectrum.terms.every((t) => Math.abs(t.n) <= SHAPE_MAX_HARMONIC)).toBe(true)
      }),
      { numRuns: 20 },
    )
  })
})

describe('toComponents', () => {
  const spectrum = analyze(normalize(resample(polygon(5), 1024)))

  test('maps terms to components with base-frequency multiples, quantised values and rotating colours', () => {
    const components = toComponents(spectrum, 5, () => 'id')
    expect(components).toHaveLength(5)
    components.forEach((c, i) => {
      expect(c.frequency.kind === 'constant' && c.frequency.value).toBeCloseTo((spectrum.terms[i]?.n ?? 0) * PRESET_BASE_FREQUENCY, 9)
      expect(c.phase.kind === 'constant' && Math.round(c.phase.value * 10)).toBe(c.phase.kind === 'constant' ? c.phase.value * 10 : NaN)
      expect(c.color).toBe(`c${i % 12}`)
      expect(c.enabled).toBe(true)
    })
  })

  test('drops negligible terms and clamps count to the available terms', () => {
    const all = toComponents(spectrum, 10_000, () => 'id')
    expect(all.length).toBeLessThan(spectrum.terms.length)
    expect(all.every((c) => c.amplitude.kind === 'constant' && c.amplitude.value >= 1e-4)).toBe(true)
  })

  test('the result is a valid function according to the persisted schema', () => {
    let i = 0
    const components = toComponents(spectrum, 60, () => `00000000-0000-4000-8000-${String(i++).padStart(12, '0')}`)
    const fn = { ...createDefaultFunction(), components }
    expect(fourierFunctionSchema.safeParse(fn).success).toBe(true)
  })
})

describe('degenerate inputs', () => {
  const dot: ShapePath = [{ x: 2, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 3 }]

  test('resample of a zero-length path repeats its only point', () => {
    const out = resample(dot, 5)
    expect(out).toHaveLength(5)
    expect(out.every((p) => p.x === 2 && p.y === 3)).toBe(true)
  })

  test('normalize of a zero-extent path only recentres', () => {
    expect(normalize(dot)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])
  })

  test('analyze handles an odd sample count', () => {
    const spectrum = analyze(normalize(resample(circle(64), 255)))
    expect(spectrum.sampleCount).toBe(255)
    expect(Math.abs(spectrum.terms[0]?.n ?? 0)).toBe(1)
  })

  test('toComponents generates UUIDs when no id factory is given', () => {
    const spectrum = analyze(normalize(resample(polygon(5), 256)))
    const components = toComponents(spectrum, 3)
    expect(new Set(components.map((c) => c.id)).size).toBe(3)
    expect(components[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
