import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '../../state/playbackStore'

export const formatTime = (seconds: number): string => seconds.toFixed(2)

/**
 * 当前时间读数 (FR-016). 直接订阅 store 写文本节点, 不走 React 渲染 (章程原则 V);
 * 也不放进 live region, 以免读屏器刷屏 (research R9).
 */
export function TimeReadout() {
  const ref = useRef<HTMLOutputElement | null>(null)

  useEffect(() => {
    const write = (time: number) => {
      if (!ref.current) return
      ref.current.textContent = formatTime(time)
      // 完整精度, 供端到端测试精确复现同一时刻
      ref.current.dataset['time'] = String(time)
    }
    write(usePlaybackStore.getState().time)
    return usePlaybackStore.subscribe((state, previous) => {
      if (state.time !== previous.time) write(state.time)
    })
  }, [])

  return (
    <p className="transport__readout">
      <span className="nameplate">时间</span>
      <output ref={ref} className="readout" data-testid="time-readout" aria-label="当前时间(秒)" />
      <span className="transport__unit">秒</span>
    </p>
  )
}
