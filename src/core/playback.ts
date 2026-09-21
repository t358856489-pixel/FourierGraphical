import {
  INITIAL_TIME_SECONDS,
  MAX_WALL_DELTA_SECONDS,
  MIN_LOOP_SECONDS,
  MIN_TIMELINE_SECONDS,
  SPEED_RANGE,
  STEP_SECONDS,
} from './ranges'
import { err, ok, type LoopRegion, type PlaybackState, type Result } from './types'

export const createPlaybackState = (): PlaybackState => ({
  time: INITIAL_TIME_SECONDS,
  maxReachedTime: INITIAL_TIME_SECONDS,
  isPlaying: false,
  speed: 1,
  loop: null,
})

const withTime = (state: PlaybackState, time: number): PlaybackState => ({
  ...state,
  time,
  maxReachedTime: Math.max(state.maxReachedTime, time),
})

const wrapIntoLoop = (time: number, loop: LoopRegion | null): number => {
  if (!loop?.enabled || time < loop.end) return time
  const length = loop.end - loop.start
  return loop.start + ((time - loop.end) % length)
}

/** 图形是 time 的纯函数, 所以回绕只需改时间, 状态自动正确 (FR-018g) */
export const advance = (state: PlaybackState, wallDeltaSeconds: number): PlaybackState => {
  if (!state.isPlaying) return state
  const delta = Math.min(Math.max(0, wallDeltaSeconds), MAX_WALL_DELTA_SECONDS) * state.speed
  return withTime(state, wrapIntoLoop(state.time + delta, state.loop))
}

export const seek = (state: PlaybackState, t: number): PlaybackState =>
  Number.isFinite(t) ? withTime(state, Math.max(0, t)) : state

export const step = (state: PlaybackState, direction: 1 | -1): PlaybackState =>
  seek(state, state.time + direction * STEP_SECONDS)

export const setSpeed = (state: PlaybackState, speed: number): Result<PlaybackState> => {
  if (!Number.isFinite(speed) || speed < SPEED_RANGE.min || speed > SPEED_RANGE.max) {
    return err('OUT_OF_RANGE', `播放速度允许范围为 ${SPEED_RANGE.min}× 到 ${SPEED_RANGE.max}×`)
  }
  return ok({ ...state, speed })
}

export const setLoop = (
  state: PlaybackState,
  region: LoopRegion | null,
): Result<PlaybackState> => {
  if (region === null) return ok({ ...state, loop: null })
  const isValid =
    Number.isFinite(region.start) &&
    Number.isFinite(region.end) &&
    region.start >= 0 &&
    region.end - region.start >= MIN_LOOP_SECONDS
  if (!isValid) {
    return err('INVALID_LOOP_REGION', `循环终点需晚于起点至少 ${MIN_LOOP_SECONDS} 秒, 且起点不小于 0`)
  }
  return ok({ ...state, loop: region })
}

export const reset = (state: PlaybackState): PlaybackState => ({
  ...state,
  time: 0,
  maxReachedTime: 0,
  isPlaying: false,
})

/** 时间轴滑块的右端 (data-model "PlaybackState") */
export const timelineEnd = (state: PlaybackState, latestKeyframeTime: number): number =>
  Math.max(state.maxReachedTime, state.loop?.end ?? 0, latestKeyframeTime, MIN_TIMELINE_SECONDS)
