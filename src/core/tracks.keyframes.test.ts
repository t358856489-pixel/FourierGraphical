import { evaluate } from './keyframes'
import { AMPLITUDE_RANGE, MAX_KEYFRAMES } from './ranges'
import { addKeyframe, keyframeAt, moveKeyframe, removeKeyframe, setEasing } from './tracks'
import { animated, constant, type Keyframe, type ParamTrack, type Result } from './types'

const kf = (time: number, value: number): Keyframe => ({ time, value, easing: 'linear' })
const unwrap = (result: Result<ParamTrack>): ParamTrack => {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('addKeyframe', () => {
  test('turns a constant track into a single-keyframe animation', () => {
    expect(unwrap(addKeyframe(constant(2), 1.5, AMPLITUDE_RANGE))).toEqual(animated([kf(1.5, 2)]))
  })

  test('inserts on the curve: the new keyframe takes the value the track already had there', () => {
    const track = animated([kf(0, 0), kf(4, 2)])
    const next = unwrap(addKeyframe(track, 1, AMPLITUDE_RANGE))
    expect(keyframeAt(next, 1)?.value).toBeCloseTo(0.5, 12)
    expect(evaluate(next, 3)).toBeCloseTo(evaluate(track, 3), 12)
  })

  test('returns the same track when a keyframe already sits at t', () => {
    const track = animated([kf(1, 1)])
    expect(unwrap(addKeyframe(track, 1, AMPLITUDE_RANGE))).toBe(track)
  })

  test('quantizes the time and clamps negatives to zero', () => {
    expect(unwrap(addKeyframe(constant(1), -3, AMPLITUDE_RANGE))).toEqual(animated([kf(0, 1)]))
    expect(keyframeAt(unwrap(addKeyframe(constant(1), 1.23456, AMPLITUDE_RANGE)), 1.235)).toBeDefined()
  })

  test('refuses the 51st keyframe', () => {
    const full = animated(Array.from({ length: MAX_KEYFRAMES }, (_, i) => kf(i, 0)))
    const result = addKeyframe(full, 0.5, AMPLITUDE_RANGE)
    expect(result.ok === false && result.error.code).toBe('KEYFRAME_LIMIT')
  })
})

describe('moveKeyframe', () => {
  const track = animated([kf(0, 0), kf(2, 1), kf(5, 2)])

  test('keeps the keyframes sorted by time', () => {
    const next = unwrap(moveKeyframe(track, 0, 3))
    expect(next.kind === 'animated' && next.keyframes.map((k) => k.time)).toEqual([2, 3, 5])
  })

  test('replaces a keyframe already occupying the target time', () => {
    const next = unwrap(moveKeyframe(track, 0, 2))
    expect(next).toEqual(animated([kf(2, 0), kf(5, 2)]))
  })

  test('reports a missing source keyframe or a constant track', () => {
    expect(moveKeyframe(track, 9, 1).ok).toBe(false)
    const result = moveKeyframe(constant(1), 0, 1)
    expect(result.ok === false && result.error.code).toBe('NOT_FOUND')
  })
})

describe('setEasing', () => {
  test('changes only the targeted keyframe', () => {
    const next = unwrap(setEasing(animated([kf(0, 0), kf(2, 1)]), 0, 'smooth'))
    expect(next).toEqual(animated([{ time: 0, value: 0, easing: 'smooth' }, kf(2, 1)]))
  })

  test('reports a missing keyframe', () => {
    expect(setEasing(animated([kf(0, 0)]), 1, 'hold').ok).toBe(false)
  })
})

describe('removeKeyframe', () => {
  test('removes one of several keyframes', () => {
    expect(unwrap(removeKeyframe(animated([kf(0, 0), kf(2, 1)]), 0))).toEqual(animated([kf(2, 1)]))
  })

  test('removing the last keyframe restores a constant with its value', () => {
    expect(unwrap(removeKeyframe(animated([kf(3, 7)]), 3))).toEqual(constant(7))
  })

  test('reports a missing keyframe', () => {
    expect(removeKeyframe(animated([kf(3, 7)]), 1).ok).toBe(false)
  })
})

describe('keyframeAt', () => {
  test('is undefined for constant tracks and empty times', () => {
    expect(keyframeAt(constant(1), 0)).toBeUndefined()
    expect(keyframeAt(animated([kf(1, 1)]), 2)).toBeUndefined()
  })
})
