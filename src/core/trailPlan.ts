import { assembleTrail, createTipSampler, maxAbsFrequency, trailStep } from './evaluator'
import {
  DEFAULT_MAX_TRAIL_POINTS,
  HIGHLIGHT_SECONDS,
  MAX_RETENTION_SECONDS,
  MIN_SAMPLES_PER_TURN,
  MIN_TRAIL_SAMPLE_RATE,
  RETAINED_TRAIL_POINT_BUDGET,
  SAMPLES_PER_TURN,
} from './ranges'
import type { FourierFunction, PresentationMode, TrailPlan, ViewSettings } from './types'

const FREQUENCY_PRECISION = 1000
const PRECISION_TOLERANCE = 1e-9

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * 图形的周期(秒); 非周期返回 null, 静止图形返回 0. 只依赖 fn, 所以仍是纯函数.
 * 频率的输入精度是 0.001, 但数值框会原样提交更细的值(如 1.23456): 这种频率不能取整后求周期,
 * 否则会算出一个错误的周期, 使轨迹出现缺口.
 */
export const periodOf = (fn: FourierFunction): number | null => {
  let common = 0
  for (const component of fn.components) {
    if (!component.enabled) continue
    const { amplitude, frequency, phase } = component
    if (
      amplitude.kind !== 'constant' ||
      frequency.kind !== 'constant' ||
      phase.kind !== 'constant'
    ) {
      return null
    }
    const scaled = frequency.value * FREQUENCY_PRECISION
    const rounded = Math.round(scaled)
    if (Math.abs(scaled - rounded) > PRECISION_TOLERANCE * FREQUENCY_PRECISION) return null
    common = gcd(common, Math.abs(rounded))
  }
  return common === 0 ? 0 : FREQUENCY_PRECISION / common
}

const fadingPlan = (
  fn: FourierFunction,
  t: number,
  windowSeconds: number,
  mode: TrailPlan['mode'],
): TrailPlan => {
  const start = Math.max(0, t - windowSeconds)
  const step = trailStep(fn, windowSeconds, DEFAULT_MAX_TRAIL_POINTS)
  const fastest = maxAbsFrequency(fn)
  return {
    start,
    end: t,
    step,
    stepPower: 0,
    highlightStart: Math.max(start, t - HIGHLIGHT_SECONDS),
    mode,
    samplesPerTurn: fastest === 0 ? Number.POSITIVE_INFINITY : 1 / (fastest * step),
    isCapped: false,
    isShortened: false,
  }
}

/** 周期性图形只需要一个周期: 之后的每一圈都精确盖在第一圈上, 而保留模式的轨迹是不透明的 */
const shrinkToPeriod = (windowSeconds: number, period: number | null): number =>
  period !== null && period < windowSeconds ? Math.max(period, HIGHLIGHT_SECONDS) : windowSeconds

/** 形状永远正确: 步长按 2 的幂放大, 但不得低于每圈 MIN_SAMPLES_PER_TURN 点; 预算仍不够就缩短窗口 */
const fitToBudget = (windowSeconds: number, baseStep: number, fastest: number) => {
  const wanted = Math.max(
    0,
    Math.ceil(Math.log2(windowSeconds / baseStep / RETAINED_TRAIL_POINT_BUDGET)),
  )
  const allowed =
    fastest === 0
      ? wanted
      : Math.max(0, Math.floor(Math.log2(1 / (MIN_SAMPLES_PER_TURN * fastest * baseStep))))
  const stepPower = Math.min(wanted, allowed)
  const step = baseStep * 2 ** stepPower
  const isShortened = wanted > allowed
  return {
    stepPower,
    step,
    isShortened,
    // 缩短后的窗口不得短于高亮段: 目前的常量组合下不会发生, 但不能靠巧合
    windowSeconds: isShortened
      ? Math.max(HIGHLIGHT_SECONDS, RETAINED_TRAIL_POINT_BUDGET * step)
      : windowSeconds,
  }
}

/** 这一帧要画的轨迹区间与采样方式: (函数, t, 显示选项, 模式) 的纯函数 (research R1–R4, amendments F1/F2) */
export const planTrail = (
  fn: FourierFunction,
  t: number,
  view: ViewSettings,
  mode: PresentationMode,
): TrailPlan => {
  if (view.trailFade) return fadingPlan(fn, t, view.trailSeconds, 'fading')
  // 波形视图本身是滚动窗口: 关闭淡化只换亮度规则, 不改窗口 (FR-003)
  if (mode === 'waveform') return fadingPlan(fn, t, view.trailSeconds, 'retained')

  const retention = view.trailRetention === 'all' ? MAX_RETENTION_SECONDS : view.trailRetention
  const fastest = maxAbsFrequency(fn)
  const baseStep = 1 / Math.max(MIN_TRAIL_SAMPLE_RATE, SAMPLES_PER_TURN * fastest)
  const wanted = shrinkToPeriod(Math.min(retention, t), periodOf(fn))
  const fitted = fitToBudget(Math.max(wanted, baseStep), baseStep, fastest)
  const start = Math.max(0, t - Math.min(wanted, fitted.windowSeconds))

  return {
    start,
    end: t,
    step: fitted.step,
    stepPower: fitted.stepPower,
    highlightStart: Math.max(start, t - HIGHLIGHT_SECONDS),
    mode: 'retained',
    samplesPerTurn: fastest === 0 ? Number.POSITIVE_INFINITY : 1 / (fastest * fitted.step),
    isCapped: view.trailRetention === 'all' && t > MAX_RETENTION_SECONDS,
    isShortened: fitted.isShortened,
  }
}

/** 按计划采样轨迹, 返回 [τ, x, y, …]; 内部点落在绝对网格 k·step 上, 因而可被缓存复用 */
export const sampleTrailPlan = (fn: FourierFunction, plan: TrailPlan): Float64Array => {
  const sampler = createTipSampler(fn)
  return assembleTrail(plan.start, plan.end, plan.step, sampler, (k) => sampler(k * plan.step))
}
