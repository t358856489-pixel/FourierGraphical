import type { VectorLink } from '../../core/evaluator'
import { integrate } from '../../core/keyframes'
import { AMPLITUDE_RANGE } from '../../core/ranges'
import type { HarmonicComponent, Vec2 } from '../../core/types'

export const HIT_RADIUS_PX = 24
const TAU = Math.PI * 2

/** 屏幕坐标下离指针最近且在命中半径内的向量端点 */
export const hitTestLink = (
  chain: readonly VectorLink[],
  pointer: Vec2,
  toScreen: (world: Vec2) => Vec2,
): VectorLink | null => {
  let best: VectorLink | null = null
  let bestDistance = HIT_RADIUS_PX
  for (const link of chain) {
    const tip = toScreen(link.to)
    const distance = Math.hypot(tip.x - pointer.x, tip.y - pointer.y)
    if (distance <= bestDistance) {
      best = link
      bestDistance = distance
    }
  }
  return best
}

const wrapHalfTurn = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180

/**
 * 把指针的世界坐标换算为该分量的振幅与相位 (FR-004).
 * 相位取离当前值最近的等价角, 避免已动画的相位轨道出现整圈跳变.
 */
export const pointerToAmplitudePhase = (
  component: HarmonicComponent,
  linkFrom: Vec2,
  pointerWorld: Vec2,
  t: number,
  currentPhase: number,
): { readonly amplitude: number; readonly phase: number } => {
  const dx = pointerWorld.x - linkFrom.x
  const dy = pointerWorld.y - linkFrom.y
  const amplitude = Math.min(AMPLITUDE_RANGE.max, Math.hypot(dx, dy))
  const angleTurns = Math.atan2(dy, dx) / TAU
  const targetPhase = (angleTurns - integrate(component.frequency, t)) * 360
  return {
    amplitude: Number(amplitude.toFixed(2)),
    phase: Number((currentPhase + wrapHalfTurn(targetPhase - currentPhase)).toFixed(1)),
  }
}
