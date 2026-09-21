import { advance, createPlaybackState, reset, seek, setLoop, setSpeed, step, timelineEnd } from './playback'
import { INITIAL_TIME_SECONDS, STEP_SECONDS } from './ranges'
import type { PlaybackState } from './types'

const playing = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  ...createPlaybackState(),
  time: 0,
  maxReachedTime: 0,
  isPlaying: true,
  ...overrides,
})

describe('createPlaybackState', () => {
  test('starts paused at the trail window so the first frame shows a full figure', () => {
    expect(createPlaybackState()).toEqual({
      time: INITIAL_TIME_SECONDS,
      maxReachedTime: INITIAL_TIME_SECONDS,
      isPlaying: false,
      speed: 1,
      loop: null,
    })
  })
})

describe('advance', () => {
  test('returns the same object while paused', () => {
    const state = createPlaybackState()
    expect(advance(state, 0.016)).toBe(state)
  })

  test('moves time by wall delta × speed and pushes maxReachedTime', () => {
    const next = advance(playing({ speed: 2 }), 0.1)
    expect(next.time).toBeCloseTo(0.2, 12)
    expect(next.maxReachedTime).toBeCloseTo(0.2, 12)
  })

  test('clamps a huge wall delta (tab returning from background)', () => {
    expect(advance(playing(), 30).time).toBeCloseTo(0.25, 12)
  })

  test('wraps inside an enabled loop region, even across several loop lengths', () => {
    const loop = { start: 2, end: 3, enabled: true }
    expect(advance(playing({ time: 2.9, loop }), 0.2).time).toBeCloseTo(2.1, 10)
    expect(advance(playing({ time: 2.9, loop, speed: 10 }), 0.25).time).toBeCloseTo(2.4, 10)
  })

  test('ignores a disabled loop region', () => {
    const loop = { start: 2, end: 3, enabled: false }
    expect(advance(playing({ time: 2.9, loop }), 0.2).time).toBeCloseTo(3.1, 10)
  })
})

describe('seek and step', () => {
  test('seek clamps negatives to zero and may extend maxReachedTime', () => {
    expect(seek(playing(), -5).time).toBe(0)
    const far = seek(playing(), 120)
    expect(far.time).toBe(120)
    expect(far.maxReachedTime).toBe(120)
  })

  test('seek ignores non-finite input', () => {
    const state = playing({ time: 4 })
    expect(seek(state, Number.NaN)).toBe(state)
  })

  test('step moves by one sixtieth of a second without changing the play state', () => {
    const state = playing({ time: 1 })
    expect(step(state, 1).time).toBeCloseTo(1 + STEP_SECONDS, 12)
    expect(step(state, -1).time).toBeCloseTo(1 - STEP_SECONDS, 12)
    expect(step(state, 1).isPlaying).toBe(true)
  })
})

describe('setSpeed', () => {
  test('accepts the documented range', () => {
    const result = setSpeed(playing(), 10)
    expect(result.ok && result.value.speed).toBe(10)
  })

  test.each([0, 0.05, 10.5, Number.NaN])('rejects %s', (speed) => {
    expect(setSpeed(playing(), speed).ok).toBe(false)
  })
})

describe('setLoop', () => {
  test('accepts a valid region and null', () => {
    const region = { start: 2, end: 6, enabled: true }
    const result = setLoop(playing(), region)
    expect(result.ok && result.value.loop).toEqual(region)
    const cleared = setLoop(playing({ loop: region }), null)
    expect(cleared.ok && cleared.value.loop).toBeNull()
  })

  test.each([
    { start: 2, end: 1, enabled: true },
    { start: 2, end: 2.05, enabled: true },
    { start: -1, end: 3, enabled: true },
  ])('rejects %j and keeps the previous region', (region) => {
    const result = setLoop(playing(), region)
    expect(result.ok === false && result.error.code).toBe('INVALID_LOOP_REGION')
  })
})

describe('reset', () => {
  test('returns to zero, paused, with the reached range cleared', () => {
    const next = reset(playing({ time: 9, maxReachedTime: 20, speed: 3 }))
    expect(next).toMatchObject({ time: 0, isPlaying: false, maxReachedTime: 0, speed: 3 })
  })
})

describe('timelineEnd', () => {
  test('is the largest of the reached time, loop end, latest keyframe and the minimum length', () => {
    expect(timelineEnd(playing(), 0)).toBe(10)
    expect(timelineEnd(playing({ maxReachedTime: 42 }), 0)).toBe(42)
    expect(timelineEnd(playing({ loop: { start: 0, end: 55, enabled: false } }), 0)).toBe(55)
    expect(timelineEnd(playing(), 70)).toBe(70)
  })
})
