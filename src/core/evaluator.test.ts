import { boundingRadius, sampleTrail, tipAt, vectorChain } from './evaluator'
import { animated, constant, type FourierFunction, type HarmonicComponent } from './types'

let nextId = 0
const component = (
  amplitude: number,
  frequency: number,
  phase = 0,
  enabled = true,
): HarmonicComponent => ({
  id: `k${nextId++}`,
  amplitude: constant(amplitude),
  frequency: constant(frequency),
  phase: constant(phase),
  enabled,
  color: 'c0',
})

const fnOf = (...components: HarmonicComponent[]): FourierFunction => ({
  id: 'f',
  schemaVersion: 1,
  name: 'test',
  components,
  presentationMode: 'waveform',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('vectorChain and tipAt', () => {
  test('an empty or fully disabled function has no vectors and its tip at the origin', () => {
    expect(vectorChain(fnOf(), 1)).toEqual([])
    expect(tipAt(fnOf(component(1, 1, 0, false)), 1)).toEqual({ x: 0, y: 0 })
  })

  test('phase of 90 degrees points the vector up at t = 0', () => {
    const tip = tipAt(fnOf(component(2, 1, 90)), 0)
    expect(tip.x).toBeCloseTo(0, 12)
    expect(tip.y).toBeCloseTo(2, 12)
  })

  test('rotates counter-clockwise for positive and clockwise for negative frequency', () => {
    expect(tipAt(fnOf(component(1, 1)), 0.25).y).toBeCloseTo(1, 12)
    expect(tipAt(fnOf(component(1, -1)), 0.25).y).toBeCloseTo(-1, 12)
  })

  test('chains vectors head to tail and reports the amplitude as radius', () => {
    const chain = vectorChain(fnOf(component(2, 0), component(1, 0, 90)), 0)
    expect(chain).toHaveLength(2)
    expect(chain[0]?.from).toEqual({ x: 0, y: 0 })
    expect(chain[1]?.from).toEqual(chain[0]?.to)
    expect(chain[0]?.radius).toBe(2)
    expect(chain[1]?.to.x).toBeCloseTo(2, 12)
    expect(chain[1]?.to.y).toBeCloseTo(1, 12)
  })

  test('skips disabled components', () => {
    const chain = vectorChain(fnOf(component(2, 0), component(5, 0, 0, false), component(1, 0)), 0)
    expect(chain.map((link) => link.radius)).toEqual([2, 1])
  })

  test('depends only on (fn, t), not on call history', () => {
    const fn = fnOf(component(1, 0.37), component(0.5, -2.1, 40))
    const direct = tipAt(fn, 12.345)
    for (let t = 0; t < 12; t += 0.5) tipAt(fn, t)
    expect(tipAt(fn, 12.345)).toEqual(direct)
  })

  test('stays precise at very large times', () => {
    // 1e6 秒 × 0.25 圈/秒 = 整 250000 圈, 加上 0.25 秒再转 1/16 圈
    const tip = tipAt(fnOf(component(1, 0.25)), 1e6 + 0.25)
    expect(tip.x).toBeCloseTo(Math.cos(Math.PI / 8), 6)
    expect(tip.y).toBeCloseTo(Math.sin(Math.PI / 8), 6)
  })
})

describe('sampleTrail', () => {
  const fn = fnOf(component(1, 1))

  test('is empty at t = 0', () => {
    expect(sampleTrail(fn, 0, 8, 4000)).toHaveLength(0)
  })

  test('covers [max(0, t - window), t] as (tau, x, y) triples ending at the current tip', () => {
    const trail = sampleTrail(fn, 3, 8, 4000)
    expect(trail.length % 3).toBe(0)
    expect(trail[0]).toBe(0)
    expect(trail[trail.length - 3]).toBeCloseTo(3, 12)
    const tip = tipAt(fn, 3)
    expect(trail[trail.length - 2]).toBeCloseTo(tip.x, 12)
    expect(trail[trail.length - 1]).toBeCloseTo(tip.y, 12)
    expect(sampleTrail(fn, 20, 8, 4000)[0]).toBeCloseTo(12, 12)
  })

  test('samples at least 32 points per turn of the fastest component', () => {
    const fast = fnOf(component(1, 10))
    const trail = sampleTrail(fast, 1, 1, 4000)
    expect(trail.length / 3).toBeGreaterThanOrEqual(320)
  })

  test('never exceeds maxPoints', () => {
    const fast = fnOf(component(1, 100))
    expect(sampleTrail(fast, 30, 30, 500).length / 3).toBeLessThanOrEqual(500)
  })
})

describe('boundingRadius', () => {
  test('sums the amplitudes of enabled components', () => {
    expect(boundingRadius(fnOf(component(2, 1), component(3, 1), component(9, 1, 0, false)))).toBe(5)
  })

  test('uses the largest keyframed amplitude', () => {
    const animatedAmplitude: HarmonicComponent = {
      ...component(0, 1),
      amplitude: animated([
        { time: 0, value: 1, easing: 'linear' },
        { time: 2, value: 4, easing: 'linear' },
      ]),
    }
    expect(boundingRadius(fnOf(animatedAmplitude, component(1, 1)))).toBe(5)
  })
})
