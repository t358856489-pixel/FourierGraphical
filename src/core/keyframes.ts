import type { Easing, Keyframe, ParamTrack } from './types'

// 各段 ∫v dt 的前缀和; 轨道不可变, 所以按引用缓存是安全的
const prefixCache = new WeakMap<readonly Keyframe[], Float64Array>()

/** 最后一个 time <= t 的关键帧下标; t 早于首关键帧时为 -1 */
const segmentIndex = (keyframes: readonly Keyframe[], t: number): number => {
  let low = 0
  let high = keyframes.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if ((keyframes[mid] as Keyframe).time <= t) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

const easedFraction = (easing: Easing, u: number): number => {
  if (easing === 'hold') return 0
  if (easing === 'linear') return u
  return u * u * (3 - 2 * u)
}

/** ∫₀ᵘ easedFraction du 的闭式解 (research R4) */
const easedFractionIntegral = (easing: Easing, u: number): number => {
  if (easing === 'hold') return 0
  if (easing === 'linear') return (u * u) / 2
  return u * u * u - (u * u * u * u) / 2
}

const segmentIntegral = (from: Keyframe, to: Keyframe, u: number): number => {
  const duration = to.time - from.time
  return (
    duration * (from.value * u + (to.value - from.value) * easedFractionIntegral(from.easing, u))
  )
}

const prefixSums = (keyframes: readonly Keyframe[]): Float64Array => {
  const cached = prefixCache.get(keyframes)
  if (cached) return cached
  const sums = new Float64Array(keyframes.length)
  for (let i = 1; i < keyframes.length; i++) {
    const from = keyframes[i - 1] as Keyframe
    const to = keyframes[i] as Keyframe
    sums[i] = (sums[i - 1] as number) + segmentIntegral(from, to, 1)
  }
  prefixCache.set(keyframes, sums)
  return sums
}

export const evaluate = (track: ParamTrack, t: number): number => {
  if (track.kind === 'constant') return track.value
  const { keyframes } = track
  const index = segmentIndex(keyframes, t)
  if (index < 0) return (keyframes[0] as Keyframe).value
  const from = keyframes[index] as Keyframe
  const to = keyframes[index + 1]
  if (!to) return from.value
  const u = (t - from.time) / (to.time - from.time)
  return from.value + (to.value - from.value) * easedFraction(from.easing, u)
}

/** ∫₀ᵗ evaluate(track, τ) dτ, 闭式求值; t <= 0 时为 0 */
export const integrate = (track: ParamTrack, t: number): number => {
  if (t <= 0) return 0
  if (track.kind === 'constant') return track.value * t
  const { keyframes } = track
  const first = keyframes[0] as Keyframe
  const index = segmentIndex(keyframes, t)
  if (index < 0) return first.value * t

  const leadIn = first.value * first.time
  const completed = prefixSums(keyframes)[index] as number
  const from = keyframes[index] as Keyframe
  const to = keyframes[index + 1]
  const partial = to
    ? segmentIntegral(from, to, (t - from.time) / (to.time - from.time))
    : from.value * (t - from.time)
  return leadIn + completed + partial
}
