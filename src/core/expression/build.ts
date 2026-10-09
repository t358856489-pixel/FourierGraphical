import { evaluate } from '../keyframes'
import { EXPRESSION_DECIMALS } from '../ranges'
import type { FourierFunction, HarmonicComponent, ParamTrack } from '../types'
import type { Coefficient, Expression, ExpressionTerm } from './types'

/** 最多 EXPRESSION_DECIMALS 位小数, 去掉末尾 0, 负零为 "0"; 记录是否发生了四舍五入 (FR-008) */
export const formatCoefficient = (value: number): Coefficient => {
  const rounded = Number(value.toFixed(EXPRESSION_DECIMALS))
  return {
    value,
    text: rounded === 0 ? '0' : String(rounded),
    isRounded: rounded !== value,
  }
}

const isAnimatedTrack = (track: ParamTrack): boolean => track.kind === 'animated'

/**
 * 全常量分量的项与 t 无关: 按分量引用缓存, 让未改动的项在每次编辑后保持同一引用,
 * 视图里的 memo 才能真正跳过它们 (research R5). 与整体重算逐项结构相等 (章程 I).
 */
const constantTermCache = new WeakMap<HarmonicComponent, ExpressionTerm>()

const termOf = (component: HarmonicComponent, t: number): ExpressionTerm => ({
  componentId: component.id,
  color: component.color,
  amplitude: formatCoefficient(evaluate(component.amplitude, t)),
  frequency: formatCoefficient(evaluate(component.frequency, t)),
  phaseDeg: formatCoefficient(evaluate(component.phase, t)),
  isAnimated: [component.amplitude, component.frequency, component.phase].some(isAnimatedTrack),
})

const cachedTermOf = (component: HarmonicComponent, t: number): ExpressionTerm => {
  const isConstant = ![component.amplitude, component.frequency, component.phase].some(
    isAnimatedTrack,
  )
  if (!isConstant) return termOf(component, t)
  const cached = constantTermCache.get(component)
  if (cached) return cached
  const term = termOf(component, t)
  constantTermCache.set(component, term)
  return term
}

/**
 * 由 (函数, t) 派生表达式结构 (specs/004 research R1).
 * 第 k 项 A·e^{i(2π·f·t + φ°)} 直接抄写求值器的约定 θ = 2π·(phase/360 + ∫f);
 * 带关键帧的参数取时刻 t 的瞬时值并标记, 其余与 t 无关.
 */
export const buildExpression = (fn: FourierFunction, t: number): Expression => {
  const terms = fn.components
    .filter((component) => component.enabled)
    .map((component) => cachedTermOf(component, t))
  return {
    terms,
    excludedCount: fn.components.length - terms.length,
    hasAnimated: terms.some((term) => term.isAnimated),
    isRounded: terms.some(
      (term) => term.amplitude.isRounded || term.frequency.isRounded || term.phaseDeg.isRounded,
    ),
    time: t,
  }
}
