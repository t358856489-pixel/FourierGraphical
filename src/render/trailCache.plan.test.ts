import { createDefaultFunction, updateTrack } from '../core/function'
import { planTrail, sampleTrailPlan } from '../core/trailPlan'
import { constant, type ViewSettings } from '../core/types'
import { INITIAL_VIEW } from '../state/viewStore'
import { createTrailCache } from './trailCache'

const base = createDefaultFunction()
const quick = updateTrack(base, base.components[0]?.id ?? '', 'frequency', constant(4.23456))
const view: ViewSettings = { ...INITIAL_VIEW, trailFade: false, trailRetention: 'all' }
const planAt = (t: number, fn = quick, v = view) => planTrail(fn, t, v, 'drawing2d')

describe('trail cache with retained plans', () => {
  test('equals a full resample at every frame while the retained trail grows', () => {
    const cache = createTrailCache()
    for (let t = 0; t < 12; t += 1 / 60) {
      const plan = planAt(t)
      expect(cache.getPlan(quick, plan)).toEqual(sampleTrailPlan(quick, plan))
    }
  })

  test('steady playback computes only a handful of new points per frame', () => {
    const cache = createTrailCache()
    cache.getPlan(quick, planAt(100))
    const before = cache.computedCount()
    cache.getPlan(quick, planAt(100 + 1 / 60))
    expect(cache.computedCount() - before).toBeLessThanOrEqual(8)
  })

  test('when the step doubles, the even grid points are reused and the result stays exact', () => {
    // 找到 stepPower 增大的那一刻
    let t = 200
    while (planAt(t + 1).stepPower === planAt(t).stepPower) t += 1
    const cache = createTrailCache()
    const before = planAt(t)
    const after = planAt(t + 1)
    expect(after.stepPower).toBe(before.stepPower + 1)

    cache.getPlan(quick, before)
    const computedBefore = cache.computedCount()
    const result = cache.getPlan(quick, after)
    expect(result).toEqual(sampleTrailPlan(quick, after))
    const total = result.length / 3
    expect(cache.computedCount() - computedBefore).toBeLessThan(total / 2)
  })

  test.each([
    ['seeking backwards', 3],
    ['jumping far ahead', 5000],
  ])('stays exact after %s', (_, target) => {
    const cache = createTrailCache()
    cache.getPlan(quick, planAt(60))
    expect(cache.getPlan(quick, planAt(target))).toEqual(sampleTrailPlan(quick, planAt(target)))
  })

  test('stays exact after the function or the retention changes', () => {
    const cache = createTrailCache()
    cache.getPlan(quick, planAt(60))
    expect(cache.getPlan(base, planAt(60, base))).toEqual(sampleTrailPlan(base, planAt(60, base)))
    const shorter = planAt(60, base, { ...view, trailRetention: 10 })
    expect(cache.getPlan(base, shorter)).toEqual(sampleTrailPlan(base, shorter))
  })

  test('the legacy window-based lookup still matches its own full resample', () => {
    const cache = createTrailCache()
    const plan = planTrail(base, 9, INITIAL_VIEW, 'waveform')
    expect(cache.get(base, 9, 8, 4000)).toEqual(sampleTrailPlan(base, plan))
  })
})
