import { create } from 'zustand'
import { DRAW_DEFAULT_SMOOTHING, SHAPE_DEFAULT_COUNT } from '../core/ranges'
import { strokeToPath } from '../core/shape/drawing'
import type { FourierFunction, Result, Vec2 } from '../core/types'
import { applySpectrum, spectrumOf } from '../features/shapes/applyShape'
import type { EditMode } from './documentStore'
import { usePlaybackStore } from './playbackStore'

/** 手绘会话 (功能 003 data-model "DrawingSession"); 刷新后消失 */
interface DrawingState {
  readonly isActive: boolean
  /** 正在画的笔迹, 画布上的屏幕像素坐标; strokeToPath 负责翻转为世界坐标 */
  readonly stroke: readonly Vec2[]
  /** 最近一次完成的原始笔迹: 调平滑与分量数时据此重算 */
  readonly lastRaw: readonly Vec2[] | null
  readonly smoothing: number
  readonly count: number
  readonly resumePlaying: boolean
  readonly canvasShortSide: number
}

interface DrawingActions {
  readonly enter: () => void
  readonly exit: () => void
  readonly append: (point: Vec2) => void
  readonly clear: () => void
  /** 松手: 校验并转换; 失败时保持绘制中 */
  readonly finish: (canvasShortSide: number) => Result<FourierFunction>
  readonly setSmoothing: (smoothing: number) => void
  readonly setCount: (count: number) => void
  /** 回到初始状态(测试与新会话用) */
  readonly reset: () => void
}

const INITIAL: DrawingState = {
  isActive: false,
  stroke: [],
  lastRaw: null,
  smoothing: DRAW_DEFAULT_SMOOTHING,
  count: SHAPE_DEFAULT_COUNT,
  resumePlaying: false,
  canvasShortSide: 1,
}

export const useDrawingStore = create<DrawingState & DrawingActions>()((set, get) => {
  const convert = (
    raw: readonly Vec2[],
    smoothing: number,
    count: number,
    shortSide: number,
    mode: EditMode = 'commit',
  ) => {
    const path = strokeToPath(raw, smoothing, shortSide)
    if (!path.ok) return path
    return applySpectrum(spectrumOf(path.value), count, mode)
  }

  return {
    ...INITIAL,
    enter: () => {
      const playback = usePlaybackStore.getState()
      set({ isActive: true, stroke: [], resumePlaying: playback.isPlaying })
      playback.pause()
    },
    exit: () => {
      const { resumePlaying, isActive } = get()
      set({ isActive: false, stroke: [] })
      if (isActive && resumePlaying) usePlaybackStore.getState().play()
    },
    reset: () => set(INITIAL),
    append: (point) => set((state) => ({ stroke: [...state.stroke, point] })),
    clear: () => set({ stroke: [] }),
    finish: (canvasShortSide) => {
      const { stroke, smoothing, count } = get()
      const result = convert(stroke, smoothing, count, canvasShortSide)
      if (!result.ok) return result
      // 转换成功后不再恢复播放: applySpectrum 已按规则开始播放或定格
      set({ lastRaw: stroke, stroke: [], canvasShortSide, resumePlaying: false })
      return result
    },
    setSmoothing: (smoothing) => {
      set({ smoothing })
      const { lastRaw, count, canvasShortSide } = get()
      // 滑块拖动中只预览; 松手时由绘制层调用 commitEdit, 整个拖动是一步撤销
      if (lastRaw) convert(lastRaw, smoothing, count, canvasShortSide, 'preview')
    },
    setCount: (count) => {
      set({ count })
      const { lastRaw, smoothing, canvasShortSide } = get()
      if (lastRaw) convert(lastRaw, smoothing, count, canvasShortSide, 'preview')
    },
  }
})
