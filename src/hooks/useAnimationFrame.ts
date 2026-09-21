import { useEffect, useRef } from 'react'

const MS_PER_SECOND = 1000

/** 每帧调用 callback(墙钟增量, 秒); 卸载时取消 */
export const useAnimationFrame = (callback: (deltaSeconds: number) => void): void => {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  }, [callback])

  useEffect(() => {
    let handle = 0
    let previous: number | null = null
    const frame = (now: number) => {
      const delta = previous === null ? 0 : (now - previous) / MS_PER_SECOND
      previous = now
      latest.current(delta)
      handle = requestAnimationFrame(frame)
    }
    handle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(handle)
  }, [])
}
