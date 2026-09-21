import { AMPLITUDE_RANGE, MAX_KEYFRAMES } from './ranges'
import { setValueAt } from './tracks'
import { animated, constant, type Keyframe } from './types'

const kf = (time: number, value: number): Keyframe => ({ time, value, easing: 'linear' })
const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error('expected ok')
  return result.value
}

describe('setValueAt', () => {
  test('replaces the value of a constant track', () => {
    expect(unwrap(setValueAt(constant(1), 3, 2, AMPLITUDE_RANGE))).toEqual(constant(2))
  })

  test('inserts a keyframe in time order when an animated track has none at t', () => {
    const track = animated([kf(0, 0), kf(5, 1)])
    const next = unwrap(setValueAt(track, 2, 0.9, AMPLITUDE_RANGE))
    expect(next).toEqual(animated([kf(0, 0), kf(2, 0.9), kf(5, 1)]))
  })

  test('updates the existing keyframe when one sits at t, keeping its easing', () => {
    const track = animated([{ time: 0, value: 0, easing: 'smooth' }, kf(5, 1)])
    const next = unwrap(setValueAt(track, 0, 0.4, AMPLITUDE_RANGE))
    expect(next).toEqual(animated([{ time: 0, value: 0.4, easing: 'smooth' }, kf(5, 1)]))
  })

  test('treats times within one millisecond quantum as the same keyframe', () => {
    const track = animated([kf(2, 0)])
    const next = unwrap(setValueAt(track, 2.0004, 1, AMPLITUDE_RANGE))
    expect(next).toEqual(animated([kf(2, 1)]))
  })

  test('does not mutate the original track', () => {
    const track = animated([kf(0, 0)])
    setValueAt(track, 1, 1, AMPLITUDE_RANGE)
    expect(track).toEqual(animated([kf(0, 0)]))
  })

  test('rejects out-of-range values with the allowed range in the message', () => {
    const result = setValueAt(constant(1), 0, 101, AMPLITUDE_RANGE)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE')
      expect(result.error.message).toContain('100')
    }
  })

  test.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects non-finite value %s', (value) => {
    const result = setValueAt(constant(1), 0, value, AMPLITUDE_RANGE)
    expect(result.ok === false && result.error.code).toBe('NOT_A_NUMBER')
  })

  test('rejects an insertion beyond the keyframe limit', () => {
    const full = animated(Array.from({ length: MAX_KEYFRAMES }, (_, i) => kf(i, 0)))
    const result = setValueAt(full, 0.5, 1, AMPLITUDE_RANGE)
    expect(result.ok === false && result.error.code).toBe('KEYFRAME_LIMIT')
  })
})
