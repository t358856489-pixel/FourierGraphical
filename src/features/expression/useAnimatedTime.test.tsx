import { act, renderHook } from '@testing-library/react'
import { EXPRESSION_REFRESH_MS } from '../../core/ranges'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { useAnimatedTime } from './useAnimatedTime'

beforeEach(() => {
  resetStores()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('useAnimatedTime (research R5)', () => {
  test('does not subscribe to playback when there are no animated parameters', () => {
    const subscribe = vi.spyOn(usePlaybackStore, 'subscribe')
    const { result } = renderHook(() => useAnimatedTime(false))
    expect(subscribe).not.toHaveBeenCalled()
    expect(typeof result.current).toBe('number')
  })

  test('subscribes when enabled, throttles updates and unsubscribes on unmount', () => {
    const subscribe = vi.spyOn(usePlaybackStore, 'subscribe')
    usePlaybackStore.getState().seek(1)
    const { result, unmount } = renderHook(() => useAnimatedTime(true))
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(1)
    // 启用时在下一个 tick 同步一次; 节流间隔过后, 下一次变化立即反映
    act(() => vi.advanceTimersByTime(EXPRESSION_REFRESH_MS))
    expect(result.current).toBe(1)

    // 第一次变化立即反映
    act(() => usePlaybackStore.getState().seek(2))
    expect(result.current).toBe(2)

    // 紧随其后的变化被节流: 间隔内不更新, 间隔到后更新为最新值
    act(() => usePlaybackStore.getState().seek(2.5))
    act(() => usePlaybackStore.getState().seek(3))
    expect(result.current).toBe(2)
    act(() => vi.advanceTimersByTime(EXPRESSION_REFRESH_MS))
    expect(result.current).toBe(3)

    unmount()
    act(() => usePlaybackStore.getState().seek(9))
    expect(result.current).toBe(3)
  })
})
