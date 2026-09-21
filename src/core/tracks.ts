import { evaluate } from './keyframes'
import { KEYFRAME_TIME_QUANTUM, MAX_KEYFRAMES, quantizeTime } from './ranges'
import {
  animated,
  constant,
  err,
  ok,
  type Easing,
  type Keyframe,
  type ParamTrack,
  type Range,
  type Result,
} from './types'

const sameTime = (a: number, b: number): boolean => Math.abs(a - b) < KEYFRAME_TIME_QUANTUM / 2

const validateValue = (value: number, range: Range): Result<number> => {
  if (!Number.isFinite(value)) return err('NOT_A_NUMBER', '请输入数字')
  if (value < range.min || value > range.max) {
    return err('OUT_OF_RANGE', `允许范围为 ${range.min} 到 ${range.max}${range.unit}`)
  }
  return ok(value)
}

const indexAt = (keyframes: readonly Keyframe[], time: number): number =>
  keyframes.findIndex((keyframe) => sameTime(keyframe.time, time))

const upsert = (keyframes: readonly Keyframe[], next: Keyframe): Result<readonly Keyframe[]> => {
  const existing = indexAt(keyframes, next.time)
  if (existing >= 0) {
    return ok(keyframes.map((keyframe, index) => (index === existing ? next : keyframe)))
  }
  if (keyframes.length >= MAX_KEYFRAMES) {
    return err('KEYFRAME_LIMIT', `每个参数最多 ${MAX_KEYFRAMES} 个关键帧`)
  }
  return ok([...keyframes, next].sort((a, b) => a.time - b.time))
}

/** 手动改值 (FR-018e): 固定值直接替换; 已动画时在 t 处更新或自动新增关键帧 */
export const setValueAt = (
  track: ParamTrack,
  t: number,
  value: number,
  range: Range,
): Result<ParamTrack> => {
  const valid = validateValue(value, range)
  if (!valid.ok) return valid
  if (track.kind === 'constant') return ok(constant(value))

  const time = quantizeTime(Math.max(0, t))
  const existing = track.keyframes[indexAt(track.keyframes, time)]
  const easing: Easing = existing?.easing ?? 'linear'
  const keyframes = upsert(track.keyframes, { time, value, easing })
  return keyframes.ok ? ok(animated(keyframes.value)) : keyframes
}

/** 在曲线上原位添加关键帧: 新关键帧的值等于添加前该时刻的求值 */
export const addKeyframe = (track: ParamTrack, t: number, range: Range): Result<ParamTrack> => {
  const time = quantizeTime(Math.max(0, t))
  const valid = validateValue(evaluate(track, time), range)
  if (!valid.ok) return valid
  if (track.kind === 'constant') {
    return ok(animated([{ time, value: valid.value, easing: 'linear' }]))
  }
  if (indexAt(track.keyframes, time) >= 0) return ok(track)
  const keyframes = upsert(track.keyframes, { time, value: valid.value, easing: 'linear' })
  return keyframes.ok ? ok(animated(keyframes.value)) : keyframes
}

const requireAnimated = (
  track: ParamTrack,
  t: number,
): Result<{ keyframes: readonly Keyframe[]; index: number }> => {
  if (track.kind !== 'animated') return err('NOT_FOUND', '该参数没有关键帧')
  const index = indexAt(track.keyframes, quantizeTime(t))
  if (index < 0) return err('NOT_FOUND', '该时刻没有关键帧')
  return ok({ keyframes: track.keyframes, index })
}

/** 移动到已被占用的时刻时, 移入者取代原有关键帧 */
export const moveKeyframe = (track: ParamTrack, from: number, to: number): Result<ParamTrack> => {
  const found = requireAnimated(track, from)
  if (!found.ok) return found
  const { keyframes, index } = found.value
  const moving = keyframes[index] as Keyframe
  const time = quantizeTime(Math.max(0, to))
  const rest = keyframes.filter((keyframe, i) => i !== index && !sameTime(keyframe.time, time))
  return ok(animated([...rest, { ...moving, time }].sort((a, b) => a.time - b.time)))
}

export const setEasing = (track: ParamTrack, t: number, easing: Easing): Result<ParamTrack> => {
  const found = requireAnimated(track, t)
  if (!found.ok) return found
  const { keyframes, index } = found.value
  return ok(animated(keyframes.map((keyframe, i) => (i === index ? { ...keyframe, easing } : keyframe))))
}

/** 删除最后一个关键帧后, 参数恢复为固定值 */
export const removeKeyframe = (track: ParamTrack, t: number): Result<ParamTrack> => {
  const found = requireAnimated(track, t)
  if (!found.ok) return found
  const { keyframes, index } = found.value
  if (keyframes.length === 1) return ok(constant((keyframes[0] as Keyframe).value))
  return ok(animated(keyframes.filter((_, i) => i !== index)))
}

export const keyframeAt = (track: ParamTrack, t: number): Keyframe | undefined =>
  track.kind === 'animated' ? track.keyframes[indexAt(track.keyframes, quantizeTime(t))] : undefined
