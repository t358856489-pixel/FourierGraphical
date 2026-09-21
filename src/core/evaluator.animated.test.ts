import fc from 'fast-check'
import { tipAt, vectorChain } from './evaluator'
import { evaluate } from './keyframes'
import { animated, constant, type Easing, type FourierFunction, type ParamTrack } from './types'

const fnOf = (amplitude: ParamTrack, frequency: ParamTrack, phase: ParamTrack): FourierFunction => ({
  id: 'f',
  schemaVersion: 1,
  name: 't',
  presentationMode: 'waveform',
  createdAt: '',
  updatedAt: '',
  components: [{ id: 'a', amplitude, frequency, phase, enabled: true, color: 'c0' }],
})

const ramp = (from: number, to: number, end: number, easing: Easing = 'linear'): ParamTrack =>
  animated([
    { time: 0, value: from, easing },
    { time: end, value: to, easing: 'linear' },
  ])

describe('frequency keyframes', () => {
  const fn = fnOf(constant(1), ramp(1, -1, 4), constant(0))

  test('the tip never jumps while the frequency changes and reverses', () => {
    const maxStep = 2 * Math.PI * 1 * 0.001 * 1.01
    for (let t = 0; t < 5; t += 0.001) {
      const a = tipAt(fn, t)
      const b = tipAt(fn, t + 0.001)
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(maxStep)
    }
  })

  test('rotation reverses after the frequency crosses zero', () => {
    const angle = (t: number) => Math.atan2(tipAt(fn, t).y, tipAt(fn, t).x)
    expect(angle(1.01) - angle(1)).toBeGreaterThan(0)
    expect(angle(3.01) - angle(3)).toBeLessThan(0)
  })

  test('scrubbing to t equals accumulating the angle from 0 in small steps (FR-018f)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.constantFrom<Easing>('linear', 'smooth', 'hold'),
        fc.double({ min: 0.1, max: 6, noNaN: true }),
        (from, to, easing, t) => {
          const frequency = ramp(from, to, 3, easing)
          const dt = 0.0005
          let turns = 0
          for (let tau = 0; tau < t; tau += dt) {
            turns += evaluate(frequency, tau + Math.min(dt, t - tau) / 2) * Math.min(dt, t - tau)
          }
          const tip = tipAt(fnOf(constant(1), frequency, constant(0)), t)
          expect(tip.x).toBeCloseTo(Math.cos(2 * Math.PI * turns), 2)
          expect(tip.y).toBeCloseTo(Math.sin(2 * Math.PI * turns), 2)
        },
      ),
      { numRuns: 25 },
    )
  })

  test('returning to a loop start gives exactly the state of seeking there (FR-018g)', () => {
    const atStart = vectorChain(fn, 2)
    for (let t = 2; t < 3.5; t += 1 / 60) vectorChain(fn, t)
    expect(vectorChain(fn, 2)).toEqual(atStart)
  })
})

describe('amplitude and phase keyframes', () => {
  test('an amplitude easing to zero collapses the vector without NaN', () => {
    const tip = tipAt(fnOf(ramp(1, 0, 2), constant(1), constant(0)), 2)
    expect(tip.x).toBeCloseTo(0, 12)
    expect(Number.isNaN(tip.y)).toBe(false)
  })

  test('a phase ramp of 360 degrees adds exactly one extra turn', () => {
    const plain = tipAt(fnOf(constant(1), constant(0.3), constant(0)), 2)
    const extra = tipAt(fnOf(constant(1), constant(0.3), ramp(0, 360, 2)), 2)
    expect(extra.x).toBeCloseTo(plain.x, 10)
    expect(extra.y).toBeCloseTo(plain.y, 10)
  })
})
