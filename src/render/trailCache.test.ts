import { sampleTrail } from '../core/evaluator'
import { addComponent, createDefaultFunction } from '../core/function'
import { createTrailCache } from './trailCache'

const WINDOW = 8
const MAX = 4000
const fn = createDefaultFunction()

describe('createTrailCache', () => {
  test('matches a full resample exactly while time moves forward', () => {
    const cache = createTrailCache()
    for (let t = 7.9; t < 9; t += 1 / 60) {
      expect(cache.get(fn, t, WINDOW, MAX)).toEqual(sampleTrail(fn, t, WINDOW, MAX))
    }
  })

  test('computes only the newly entered grid points on a small forward step', () => {
    const cache = createTrailCache()
    cache.get(fn, 10, WINDOW, MAX)
    const afterFirst = cache.computedCount()
    cache.get(fn, 10 + 1 / 60, WINDOW, MAX)
    expect(cache.computedCount() - afterFirst).toBeLessThanOrEqual(2)
    expect(afterFirst).toBeGreaterThan(100)
  })

  test.each([
    ['seeking backwards', 3],
    ['jumping far ahead', 500],
  ])('stays exact after %s', (_, target) => {
    const cache = createTrailCache()
    cache.get(fn, 10, WINDOW, MAX)
    expect(cache.get(fn, target, WINDOW, MAX)).toEqual(sampleTrail(fn, target, WINDOW, MAX))
  })

  test('discards everything when the function or the window changes', () => {
    const cache = createTrailCache()
    cache.get(fn, 10, WINDOW, MAX)
    const edited = addComponent(fn)
    if (!edited.ok) throw new Error('fixture')
    expect(cache.get(edited.value, 10, WINDOW, MAX)).toEqual(sampleTrail(edited.value, 10, WINDOW, MAX))
    expect(cache.get(edited.value, 10, 4, MAX)).toEqual(sampleTrail(edited.value, 10, 4, MAX))
  })

  test('is empty at t = 0', () => {
    expect(createTrailCache().get(fn, 0, WINDOW, MAX)).toHaveLength(0)
  })
})
