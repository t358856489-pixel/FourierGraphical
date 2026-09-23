import fc from 'fast-check'
import { sampleTrail, trailStep } from './evaluator'
import { createDefaultFunction, updateTrack } from './function'
import {
  DEFAULT_MAX_TRAIL_POINTS,
  HIGHLIGHT_SECONDS,
  MIN_SAMPLES_PER_TURN,
  RETAINED_TRAIL_POINT_BUDGET,
} from './ranges'
import { periodOf, planTrail, sampleTrailPlan } from './trailPlan'
import { animated, constant, type FourierFunction, type ViewSettings } from './types'

const base = createDefaultFunction() // 频率 0.2 / 0.6 / 1.0
const ids = base.components.map((component) => component.id) as [string, string, string]
const withFrequencies = (...values: number[]): FourierFunction =>
  values.reduce((fn, value, index) => updateTrack(fn, ids[index] ?? '', 'frequency', constant(value)), base)

const view = (patch: Partial<ViewSettings> = {}): ViewSettings => ({
  zoom: 'auto',
  pan: { x: 0, y: 0 },
  showVectors: true,
  showCircles: true,
  showTrail: true,
  showGrid: true,
  trailSeconds: 8,
  showAxes: true,
  trailFade: true,
  trailRetention: 'all',
  background: null,
  highlightedComponentId: null,
  selectedComponentId: null,
  ...patch,
})
const retained = (patch: Partial<ViewSettings> = {}) => view({ trailFade: false, ...patch })
const pointsOf = (plan: { start: number; end: number; step: number }) => (plan.end - plan.start) / plan.step

describe('periodOf', () => {
  test('integer multiples of a base frequency give the base period', () => {
    expect(periodOf(base)).toBeCloseTo(5, 9)
  })

  test('incommensurate-looking decimals still have an exact period', () => {
    expect(periodOf(withFrequencies(1.37, 2.5, 0))).toBeCloseTo(100, 9)
  })

  test('any keyframed track makes the function non-periodic', () => {
    const keyframed = updateTrack(base, ids[0], 'amplitude', animated([{ time: 0, value: 1, easing: 'linear' }]))
    expect(periodOf(keyframed)).toBeNull()
  })

  test('a frequency finer than the 0.001 input precision is not rounded into a false period', () => {
    expect(periodOf(withFrequencies(1.23456, 0.6, 1))).toBeNull()
  })

  test('a still figure has period zero; disabled components are ignored', () => {
    expect(periodOf(withFrequencies(0, 0, 0))).toBe(0)
    expect(periodOf({ ...base, components: [] })).toBe(0)
    const disabled = { ...withFrequencies(1.23456, 0.6, 1) }
    const first = disabled.components[0]
    if (!first) throw new Error('fixture')
    expect(periodOf({ ...disabled, components: [{ ...first, enabled: false }, ...disabled.components.slice(1)] })).toBeCloseTo(5, 9)
  })
})

describe('planTrail with fading on (feature 001 behaviour)', () => {
  test.each([3, 20])('matches the existing window and step at t = %s', (t) => {
    const plan = planTrail(base, t, view(), 'drawing2d')
    expect(plan.mode).toBe('fading')
    expect(plan.start).toBe(Math.max(0, t - 8))
    expect(plan.end).toBe(t)
    expect(plan.step).toBe(trailStep(base, 8, DEFAULT_MAX_TRAIL_POINTS))
    expect(sampleTrailPlan(base, plan)).toEqual(sampleTrail(base, t, 8, DEFAULT_MAX_TRAIL_POINTS))
  })
})

describe('planTrail with fading off', () => {
  const aperiodic = withFrequencies(1.23456, 0.6, 1)

  test('"all" keeps everything from zero', () => {
    const plan = planTrail(aperiodic, 20, retained(), 'drawing2d')
    expect([plan.mode, plan.start, plan.end]).toEqual(['retained', 0, 20])
    expect(plan.isCapped).toBe(false)
  })

  test('"all" is capped at ten minutes and says so', () => {
    const plan = planTrail(aperiodic, 900, retained(), 'drawing2d')
    expect(plan.end - plan.start).toBeLessThanOrEqual(600)
    expect(plan.isCapped).toBe(true)
  })

  test('a finite retention keeps only that many seconds', () => {
    const plan = planTrail(aperiodic, 100, retained({ trailRetention: 30 }), 'drawing2d')
    expect(plan.start).toBeCloseTo(70, 9)
  })

  test('the waveform view keeps its own scrolling window and only changes the brightness rule', () => {
    const plan = planTrail(aperiodic, 100, retained(), 'waveform')
    expect([plan.mode, plan.start]).toEqual(['retained', 92])
  })

  test('is empty at t = 0', () => {
    const plan = planTrail(base, 0, retained(), 'drawing2d')
    expect(plan.end - plan.start).toBe(0)
    expect(sampleTrailPlan(base, plan)).toHaveLength(0)
  })

  test('a periodic function only needs one period, however long it has been running', () => {
    const plan = planTrail(base, 600, retained(), 'drawing2d')
    expect(plan.end - plan.start).toBeCloseTo(5, 9)
    expect(plan.isShortened).toBe(false)
  })

  test('the period shortcut never cuts into the highlighted head', () => {
    const fast = withFrequencies(2, 4, 6) // 周期 0.5 秒
    const plan = planTrail(fast, 50, retained(), 'drawing2d')
    expect(plan.end - plan.start).toBeGreaterThanOrEqual(HIGHLIGHT_SECONDS)
  })

  test('highlight covers the last two seconds, clipped to the window', () => {
    expect(planTrail(aperiodic, 20, retained(), 'drawing2d').highlightStart).toBe(18)
    expect(planTrail(aperiodic, 1, retained(), 'drawing2d').highlightStart).toBe(0)
  })

  test('stays within the point budget using a power-of-two multiple of the base step', () => {
    // 4.23456 圈/秒 → 基础采样约 135 点/秒, 10 分钟约 8 万点, 超出预算
    const quick = withFrequencies(4.23456, 0.6, 1)
    const plan = planTrail(quick, 600, retained(), 'drawing2d')
    const baseStep = planTrail(quick, 1, retained(), 'drawing2d').step
    expect(pointsOf(plan)).toBeLessThanOrEqual(RETAINED_TRAIL_POINT_BUDGET)
    expect(plan.step).toBe(baseStep * 2 ** plan.stepPower)
    expect(plan.stepPower).toBeGreaterThan(0)
    expect(pointsOf({ ...plan, step: plan.step / 2 })).toBeGreaterThan(RETAINED_TRAIL_POINT_BUDGET)
  })

  test('never undersamples the shape: a fast function gets a shorter window instead', () => {
    const fast = withFrequencies(97.123456, 0.6, 1)
    const plan = planTrail(fast, 600, retained(), 'drawing2d')
    expect(plan.samplesPerTurn).toBeGreaterThanOrEqual(MIN_SAMPLES_PER_TURN)
    expect(plan.isShortened).toBe(true)
    expect(plan.end - plan.start).toBeLessThan(600)
    expect(pointsOf(plan)).toBeLessThanOrEqual(RETAINED_TRAIL_POINT_BUDGET + 1)
  })

  test('depends only on its inputs', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (t) => {
        expect(planTrail(aperiodic, t, retained(), 'drawing2d')).toEqual(
          planTrail(aperiodic, t, retained(), 'drawing2d'),
        )
      }),
      { numRuns: 30 },
    )
  })
})

describe('sampleTrailPlan', () => {
  test('starts at the window start, ends at the current tip, with interior points on the absolute grid', () => {
    const plan = planTrail(withFrequencies(1.23456, 0.6, 1), 37.3, retained({ trailRetention: 10 }), 'drawing2d')
    const trail = sampleTrailPlan(withFrequencies(1.23456, 0.6, 1), plan)
    expect(trail[0]).toBeCloseTo(plan.start, 12)
    expect(trail[trail.length - 3]).toBe(37.3)
    const interior = trail[3] as number
    expect(Math.abs(interior / plan.step - Math.round(interior / plan.step))).toBeLessThan(1e-6)
  })
})

describe('planTrail invariants across the whole frequency range', () => {
  test('a shortened window is never narrower than the highlighted head', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100, noNaN: true }),
        fc.double({ min: 2, max: 2000, noNaN: true }),
        (frequency, t) => {
          // 加一个细于 0.001 的偏移, 使函数非周期, 走满预算路径
          const plan = planTrail(withFrequencies(frequency + 1e-7, 0.6, 1), t, retained(), 'drawing2d')
          expect(plan.end - plan.start).toBeGreaterThanOrEqual(Math.min(t, HIGHLIGHT_SECONDS) - 1e-9)
          expect(plan.samplesPerTurn).toBeGreaterThanOrEqual(MIN_SAMPLES_PER_TURN - 1e-9)
        },
      ),
      { numRuns: 200 },
    )
  })
})
