import { evaluate, integrate } from './keyframes'
import { MIN_TRAIL_SAMPLE_RATE, SAMPLES_PER_TURN } from './ranges'
import type { FourierFunction, HarmonicComponent, ParamTrack, Vec2 } from './types'

export interface VectorLink {
  readonly componentId: string
  readonly color: string
  readonly from: Vec2
  readonly to: Vec2
  readonly radius: number
}

const TAU = Math.PI * 2
const ORIGIN: Vec2 = { x: 0, y: 0 }

const enabledComponents = (fn: FourierFunction): readonly HarmonicComponent[] =>
  fn.components.filter((component) => component.enabled)

/** θ = 2π·frac(phase/360 + ∫f): 先取小数圈数再乘 2π, 保证大 t 下的精度 (research R4) */
const angleAt = (component: HarmonicComponent, t: number): number => {
  const turns = evaluate(component.phase, t) / 360 + integrate(component.frequency, t)
  return TAU * (turns - Math.floor(turns))
}

export const vectorChain = (fn: FourierFunction, t: number): readonly VectorLink[] => {
  let from = ORIGIN
  return enabledComponents(fn).map((component) => {
    const radius = evaluate(component.amplitude, t)
    const angle = angleAt(component, t)
    const to = { x: from.x + radius * Math.cos(angle), y: from.y + radius * Math.sin(angle) }
    const link = { componentId: component.id, color: component.color, from, to, radius }
    from = to
    return link
  })
}

const tipOf = (components: readonly HarmonicComponent[], t: number): Vec2 => {
  let x = 0
  let y = 0
  for (const component of components) {
    const radius = evaluate(component.amplitude, t)
    const angle = angleAt(component, t)
    x += radius * Math.cos(angle)
    y += radius * Math.sin(angle)
  }
  return { x, y }
}

export const tipAt = (fn: FourierFunction, t: number): Vec2 => tipOf(enabledComponents(fn), t)

const maxAbs = (track: ParamTrack): number =>
  track.kind === 'constant'
    ? Math.abs(track.value)
    : Math.max(...track.keyframes.map((keyframe) => Math.abs(keyframe.value)))

export const maxAbsFrequency = (fn: FourierFunction): number =>
  enabledComponents(fn).reduce((max, component) => Math.max(max, maxAbs(component.frequency)), 0)

/** 轨迹采样的时间步长: 采样率与显示帧率无关, 只取决于最快的分量 (research R5) */
export const trailStep = (fn: FourierFunction, windowSeconds: number, maxPoints: number): number => {
  const rate = Math.max(MIN_TRAIL_SAMPLE_RATE, SAMPLES_PER_TURN * maxAbsFrequency(fn))
  // 预留两端点与取整余量
  const budgetRate = Math.max(1, maxPoints - 3) / windowSeconds
  return 1 / Math.min(rate, budgetRate)
}

/** 采样落在绝对时间网格 k·step 上, 这样相邻两帧的采样点重合, 可被缓存复用 */
export const trailGridRange = (
  start: number,
  t: number,
  step: number,
): { readonly first: number; readonly last: number } => ({
  first: Math.floor(start / step) + 1,
  last: Math.ceil(t / step) - 1,
})

export type TipSampler = (tau: number) => Vec2

export const createTipSampler = (fn: FourierFunction): TipSampler => {
  const components = enabledComponents(fn)
  return (tau) => tipOf(components, tau)
}

/** 由端点与网格点拼出 [τ, x, y, …]; gridTip 允许调用方提供缓存过的网格点 */
export const assembleTrail = (
  start: number,
  t: number,
  step: number,
  sampler: TipSampler,
  gridTip: (k: number) => Vec2,
): Float64Array => {
  if (t <= start) return new Float64Array(0)
  const { first, last } = trailGridRange(start, t, step)
  const gridCount = Math.max(0, last - first + 1)
  const trail = new Float64Array((gridCount + 2) * 3)
  const write = (index: number, tau: number, tip: Vec2) => {
    trail[index * 3] = tau
    trail[index * 3 + 1] = tip.x
    trail[index * 3 + 2] = tip.y
  }
  write(0, start, sampler(start))
  for (let k = first; k <= last; k++) write(k - first + 1, k * step, gridTip(k))
  write(gridCount + 1, t, sampler(t))
  return trail
}

/** 轨迹是 t 的纯函数: 在 [max(0, t−W), t] 上采样末端, 返回 [τ, x, y, …] */
export const sampleTrail = (
  fn: FourierFunction,
  t: number,
  windowSeconds: number,
  maxPoints: number,
): Float64Array => {
  const step = trailStep(fn, windowSeconds, maxPoints)
  const sampler = createTipSampler(fn)
  return assembleTrail(Math.max(0, t - windowSeconds), t, step, sampler, (k) => sampler(k * step))
}

export const boundingRadius = (fn: FourierFunction): number =>
  enabledComponents(fn).reduce((sum, component) => sum + maxAbs(component.amplitude), 0)
