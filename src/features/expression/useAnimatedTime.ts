import { useEffect, useState } from 'react'
import { EXPRESSION_REFRESH_MS } from '../../core/ranges'
import { usePlaybackStore } from '../../state/playbackStore'

/**
 * 含动画参数时表达式要跟随播放时刻 (specs/004 research R5): 只在 enabled 时订阅播放 store,
 * 并按 EXPRESSION_REFRESH_MS 节流, 让数字读得清, 也不让 React 提交挤占画布的 rAF 循环.
 * 不含动画参数时不订阅——表达式与 t 无关.
 */
export function useAnimatedTime(enabled: boolean): number {
  const [time, setTime] = useState(() => usePlaybackStore.getState().time)

  useEffect(() => {
    if (!enabled) return undefined
    let lastUpdate = 0
    let pending: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      pending = null
      lastUpdate = Date.now()
      setTime(usePlaybackStore.getState().time)
    }
    // 启用那一刻先同步一次(下一个 tick, 不在 effect 内同步 setState)
    pending = setTimeout(flush, 0)
    const unsubscribe = usePlaybackStore.subscribe((state, previous) => {
      if (state.time === previous.time || pending) return
      const elapsed = Date.now() - lastUpdate
      if (elapsed >= EXPRESSION_REFRESH_MS) flush()
      else pending = setTimeout(flush, EXPRESSION_REFRESH_MS - elapsed)
    })
    return () => {
      unsubscribe()
      if (pending) clearTimeout(pending)
    }
  }, [enabled])

  return time
}
