import { useCallback, useRef, type RefObject } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { drawFrame, type FrameSize } from '../../render/drawFrame'
import { derivePalette } from '../../render/palette'
import { readRenderTheme, type RenderTheme } from '../../render/theme'
import { createTrailCache, type TrailCache } from '../../render/trailCache'
import { planTrail } from '../../core/trailPlan'
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
  const baseTheme = useRef<RenderTheme | null>(null)
  // 按背景色记忆化: 背景不变时复用同一个主题对象, 不每帧分配
  const themed = useRef<{ background: string | null; theme: RenderTheme } | null>(null)
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

      baseTheme.current ??= readRenderTheme(document.documentElement)
      if (themed.current?.background !== viewState.background) {
        themed.current = {
          background: viewState.background,
          theme: derivePalette(viewState.background, baseTheme.current),
        }
      }
      trailCache.current ??= createTrailCache()
      const view = selectViewSettings(viewState)
      const plan = planTrail(fn, time, view, fn.presentationMode)
      const trail = trailCache.current.getPlan(fn, plan)
      drawFrame(ctx, fn, time, view, size, themed.current.theme, trail)
      drawn.current = { fn, time, view: viewState, ...size }
    },
    [canvasRef, sizeRef],
  )

  useAnimationFrame(frame)
}
