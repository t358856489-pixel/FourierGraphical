import { create } from 'zustand'
import {
  advance,
  createPlaybackState,
  reset,
  seek,
  setLoop,
  setSpeed,
  step,
} from '../core/playback'
import type { LoopRegion, PlaybackState, Result } from '../core/types'

interface PlaybackActions {
  readonly play: () => void
  readonly pause: () => void
  readonly toggle: () => void
  readonly tick: (wallDeltaSeconds: number) => void
  readonly seek: (t: number) => void
  readonly step: (direction: 1 | -1) => void
  readonly setSpeed: (speed: number) => Result<PlaybackState>
  readonly setLoop: (region: LoopRegion | null) => Result<PlaybackState>
  readonly reset: () => void
  readonly restore: (state: Pick<PlaybackState, 'time' | 'speed' | 'loop'>) => void
}

const pick = (state: PlaybackState): PlaybackState => ({
  time: state.time,
  maxReachedTime: state.maxReachedTime,
  isPlaying: state.isPlaying,
  speed: state.speed,
  loop: state.loop,
})

export const usePlaybackStore = create<PlaybackState & PlaybackActions>()((set, get) => {
  const applyResult = (result: Result<PlaybackState>): Result<PlaybackState> => {
    if (result.ok) set(result.value)
    return result
  }
  return {
    ...createPlaybackState(),
    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
    tick: (wallDeltaSeconds) => {
      const current = pick(get())
      const next = advance(current, wallDeltaSeconds)
      if (next !== current) set(next)
    },
    seek: (t) => set(seek(pick(get()), t)),
    step: (direction) => set(step(pick(get()), direction)),
    setSpeed: (speed) => applyResult(setSpeed(pick(get()), speed)),
    setLoop: (region) => applyResult(setLoop(pick(get()), region)),
    reset: () => set(reset(pick(get()))),
    restore: ({ time, speed, loop }) =>
      set({ time, speed, loop, isPlaying: false, maxReachedTime: time }),
  }
})
