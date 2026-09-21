import fc from 'fast-check'
import { evaluate, integrate } from './keyframes'
import { animated, constant, type Easing, type Keyframe } from './types'

const kf = (time: number, value: number, easing: Easing = 'linear'): Keyframe => ({
  time,
  value,
  easing,
})

const simpson = (f: (x: number) => number, a: number, b: number, n = 2000): number => {
  if (b <= a) return 0
  const h = (b - a) / n
  let sum = f(a) + f(b)
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 === 0 ? 2 : 4)
  return (sum * h) / 3
}

describe('evaluate', () => {
  test('constant track returns its value at any time', () => {
    expect(evaluate(constant(3), 0)).toBe(3)
    expect(evaluate(constant(3), 1e6)).toBe(3)
  })

  test('holds the first value before the first keyframe and the last value after the last', () => {
    const track = animated([kf(2, 10), kf(4, 20)])
    expect(evaluate(track, 0)).toBe(10)
    expect(evaluate(track, 2)).toBe(10)
    expect(evaluate(track, 4)).toBe(20)
    expect(evaluate(track, 99)).toBe(20)
  })

  test('linear segment reaches the average at its midpoint', () => {
    const track = animated([kf(0, 0), kf(5, 1)])
    expect(evaluate(track, 2.5)).toBeCloseTo(0.5, 12)
  })

  test('hold segment keeps the previous value until the next keyframe', () => {
    const track = animated([kf(0, 1, 'hold'), kf(2, 5)])
    expect(evaluate(track, 1.999)).toBe(1)
    expect(evaluate(track, 2)).toBe(5)
  })

  test('smooth segment is a smoothstep with zero slope at both ends', () => {
    const track = animated([kf(0, 0, 'smooth'), kf(1, 1)])
    const eps = 1e-5
    expect(evaluate(track, 0.5)).toBeCloseTo(0.5, 12)
    expect(evaluate(track, 0.25)).toBeCloseTo(3 * 0.25 ** 2 - 2 * 0.25 ** 3, 12)
    expect(evaluate(track, eps) / eps).toBeLessThan(1e-3)
    expect((1 - evaluate(track, 1 - eps)) / eps).toBeLessThan(1e-3)
  })

  test('single keyframe behaves like a constant', () => {
    const track = animated([kf(3, 7)])
    expect(evaluate(track, 0)).toBe(7)
    expect(evaluate(track, 10)).toBe(7)
  })

  test('uses the easing of the segment start for each of several segments', () => {
    const track = animated([kf(0, 0, 'linear'), kf(1, 1, 'hold'), kf(2, 3, 'linear'), kf(4, 5)])
    expect(evaluate(track, 0.5)).toBeCloseTo(0.5, 12)
    expect(evaluate(track, 1.5)).toBe(1)
    expect(evaluate(track, 3)).toBeCloseTo(4, 12)
  })
})

describe('integrate', () => {
  test('constant track integrates to value × t', () => {
    expect(integrate(constant(2), 3)).toBe(6)
    expect(integrate(constant(-2), 3)).toBe(-6)
  })

  test('is zero at t = 0 and for negative t', () => {
    const track = animated([kf(0, 1), kf(2, 3)])
    expect(integrate(track, 0)).toBe(0)
    expect(integrate(track, -1)).toBe(0)
  })

  test('includes the constant lead-in before the first keyframe', () => {
    const track = animated([kf(2, 4), kf(4, 4)])
    expect(integrate(track, 1)).toBeCloseTo(4, 12)
    expect(integrate(track, 3)).toBeCloseTo(12, 12)
  })

  test.each<[Easing, number]>([
    ['hold', 2 * 1],
    ['linear', 2 * (1 + 3) * 0.5],
    ['smooth', 2 * (1 + 3) * 0.5],
  ])('%s segment from 1 to 3 over 2s integrates to %f', (easing, expected) => {
    const track = animated([kf(0, 1, easing), kf(2, 3)])
    expect(integrate(track, 2)).toBeCloseTo(expected, 12)
  })

  test('continues with the last value after the last keyframe', () => {
    const track = animated([kf(0, 0), kf(2, 2)])
    expect(integrate(track, 5)).toBeCloseTo(2 + 3 * 2, 12)
  })

  test('returns the same result on repeated calls (prefix cache is transparent)', () => {
    const track = animated([kf(0, 1, 'smooth'), kf(1, -2, 'linear'), kf(3, 4)])
    expect(integrate(track, 2.2)).toBe(integrate(track, 2.2))
  })
})

const easingArb = fc.constantFrom<Easing>('linear', 'smooth', 'hold')
const trackArb = fc
  .array(
    fc.record({
      gap: fc.double({ min: 0.01, max: 5, noNaN: true }),
      value: fc.double({ min: -100, max: 100, noNaN: true }),
      easing: easingArb,
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((items) => {
    let time = 0
    return animated(
      items.map((item) => {
        time += item.gap
        return kf(time, item.value, item.easing)
      }),
    )
  })

describe('integrate properties', () => {
  test('closed form matches numeric integration of evaluate on every segment', () => {
    fc.assert(
      fc.property(trackArb, fc.double({ min: 0, max: 1, noNaN: true }), (track, fraction) => {
        if (track.kind !== 'animated') return
        const times = [0, ...track.keyframes.map((k) => k.time)]
        const end = (times.at(-1) ?? 0) + 2
        const t = fraction * end
        let numeric = 0
        const cuts = [...times.filter((x) => x < t), t]
        for (let i = 1; i < cuts.length; i++) {
          const a = cuts[i - 1] ?? 0
          const b = cuts[i] ?? 0
          // 段内取开区间, 避开 hold 的跳变点
          numeric += simpson((x) => evaluate(track, Math.min(x, b - 1e-12)), a, b)
        }
        expect(Math.abs(integrate(track, t) - numeric)).toBeLessThan(1e-6)
      }),
      { numRuns: 60 },
    )
  })

  test('is continuous in t, including across keyframes', () => {
    fc.assert(
      fc.property(trackArb, fc.double({ min: 0, max: 40, noNaN: true }), (track, t) => {
        const delta = 1e-7
        const jump = Math.abs(integrate(track, t + delta) - integrate(track, t))
        expect(jump).toBeLessThanOrEqual(100 * delta * 1.0001 + 1e-12)
      }),
      { numRuns: 100 },
    )
  })
})
