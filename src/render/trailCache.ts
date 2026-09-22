import { assembleTrail, createTipSampler, trailGridRange, trailStep } from '../core/evaluator'
import type { FourierFunction, TrailPlan, Vec2 } from '../core/types'

export interface TrailCache {
  /** 功能 001 的入口: 按窗口长度查询 */
  readonly get: (
    fn: FourierFunction,
    t: number,
    windowSeconds: number,
    maxPoints: number,
  ) => Float64Array
  /** 按采样计划查询 (功能 002) */
  readonly getPlan: (fn: FourierFunction, plan: TrailPlan) => Float64Array
  /** 自创建以来实际计算过的网格点数, 供测试验证增量行为 */
  readonly computedCount: () => number
}

interface Window {
  readonly start: number
  readonly end: number
  readonly step: number
}

/**
 * 稳态播放时只计算新进入窗口的网格点 (功能 001 research R5, 功能 002 research R5).
 * 结果必须与整体重算逐点相等 (章程原则 I): 二者共用 assembleTrail 与同一绝对网格.
 */
export const createTrailCache = (): TrailCache => {
  let cachedFn: FourierFunction | null = null
  let cachedStep = 0
  let points = new Map<number, Vec2>()
  let computed = 0

  // 步长翻倍时新网格是旧网格的偶数下标: k·(2s) 与 (2k)·s 是同一个浮点数, 直接复用
  const halveGrid = (): Map<number, Vec2> => {
    const next = new Map<number, Vec2>()
    for (const [k, tip] of points) {
      if (k % 2 === 0) next.set(k / 2, tip)
    }
    return next
  }

  const lookup = (fn: FourierFunction, { start, end, step }: Window): Float64Array => {
    if (fn !== cachedFn) points = new Map()
    else if (step === cachedStep * 2) points = halveGrid()
    else if (step !== cachedStep) points = new Map()
    cachedFn = fn
    cachedStep = step

    const { first, last } = trailGridRange(start, end, step)
    for (const k of points.keys()) {
      if (k < first || k > last) points.delete(k)
    }
    const sampler = createTipSampler(fn)
    return assembleTrail(start, end, step, sampler, (k) => {
      const known = points.get(k)
      if (known) return known
      const tip = sampler(k * step)
      points.set(k, tip)
      computed += 1
      return tip
    })
  }

  return {
    computedCount: () => computed,
    get: (fn, t, windowSeconds, maxPoints) =>
      lookup(fn, {
        start: Math.max(0, t - windowSeconds),
        end: t,
        step: trailStep(fn, windowSeconds, maxPoints),
      }),
    getPlan: (fn, plan) => lookup(fn, plan),
  }
}
