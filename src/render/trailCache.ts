import { assembleTrail, createTipSampler, trailGridRange, trailStep } from '../core/evaluator'
import type { FourierFunction, Vec2 } from '../core/types'

export interface TrailCache {
  readonly get: (
    fn: FourierFunction,
    t: number,
    windowSeconds: number,
    maxPoints: number,
  ) => Float64Array
  /** 自创建以来实际计算过的网格点数, 供测试验证增量行为 */
  readonly computedCount: () => number
}

/**
 * 稳态播放时只计算新进入窗口的网格点 (research R5).
 * 结果必须与 sampleTrail 的整体重算逐点相等 (章程原则 I): 二者共用 assembleTrail 与同一网格.
 */
export const createTrailCache = (): TrailCache => {
  let cachedFn: FourierFunction | null = null
  let cachedStep = 0
  let points = new Map<number, Vec2>()
  let computed = 0

  return {
    computedCount: () => computed,
    get: (fn, t, windowSeconds, maxPoints) => {
      const step = trailStep(fn, windowSeconds, maxPoints)
      if (fn !== cachedFn || step !== cachedStep) {
        cachedFn = fn
        cachedStep = step
        points = new Map()
      }
      const start = Math.max(0, t - windowSeconds)
      const { first, last } = trailGridRange(start, t, step)
      for (const k of points.keys()) {
        if (k < first || k > last) points.delete(k)
      }
      const sampler = createTipSampler(fn)
      return assembleTrail(start, t, step, sampler, (k) => {
        const known = points.get(k)
        if (known) return known
        const tip = sampler(k * step)
        points.set(k, tip)
        computed += 1
        return tip
      })
    },
  }
}
