import { useCallback, useRef, type RefObject } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { drawFrame, type FrameSize } from '../../render/drawFrame'
import { readRenderTheme, type RenderTheme } from '../../render/theme'
import { createTrailCache, type TrailCache } from '../../render/trailCache'
import { DEFAULT_MAX_TRAIL_POINTS } from '../../core/ranges'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { selectViewSettings, useViewStore } from '../../state/viewStore'

interface DrawnState {
  fn: unknown
  time: number
  view: unknown
  width: number
  height: number
  pixelRatio: number
}

/**
 * 60fps 渲染路径直接读取 store, 不经过 React 渲染 (章程原则 V).
 * 只有在函数 / 时刻 / 视图 / 尺寸变化时才重绘.
 */
export const useStageLoop = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  sizeRef: RefObject<FrameSize>,
): void => {
  const drawn = useRef<DrawnState | null>(null)
  const theme = useRef<RenderTheme | null>(null)
  const trailCache = useRef<TrailCache | null>(null)

  const frame = useCallback(
    (deltaSeconds: number) => {
      usePlaybackStore.getState().tick(deltaSeconds)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const size = sizeRef.current
      if (!canvas || !ctx || size.width === 0 || size.height === 0) return

      const fn = selectFunction(useDocumentStore.getState())
      const time = usePlaybackStore.getState().time
      const viewState = useViewStore.getState()
      const last = drawn.current
      const isUnchanged =
        last !== null &&
        last.fn === fn &&
        last.time === time &&
        last.view === viewState &&
        last.width === size.width &&
        last.height === size.height &&
        last.pixelRatio === size.pixelRatio
      if (isUnchanged) return

      theme.current ??= readRenderTheme(document.documentElement)
      trailCache.current ??= createTrailCache()
      const view = selectViewSettings(viewState)
      const trail = trailCache.current.get(fn, time, view.trailSeconds, DEFAULT_MAX_TRAIL_POINTS)
      drawFrame(ctx, fn, time, view, size, theme.current, trail)
      drawn.current = { fn, time, view: viewState, ...size }
    },
    [canvasRef, sizeRef],
  )

  useAnimationFrame(frame)
}
