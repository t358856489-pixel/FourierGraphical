import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { PARAM_LABELS } from '../../core/ranges'
import type { FrameSize } from '../../render/drawFrame'
import { derivePalette } from '../../render/palette'
import { readRenderTheme } from '../../render/theme'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { useViewStore } from '../../state/viewStore'
import { setStageSize } from './stageSize'
import { useStageLoop } from './useStageLoop'
import { useStagePointer } from './useStagePointer'
import './stage.css'

const MODE_LABELS = { waveform: '波形模式', drawing2d: '二维绘图模式' } as const

function useCanvasSize(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const sizeRef = useRef<FrameSize>({ width: 0, height: 0, pixelRatio: 1 })
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const pixelRatio = window.devicePixelRatio || 1
      const { width, height } = entry.contentRect
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      sizeRef.current = { width, height, pixelRatio }
      setStageSize(width, height)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvasRef])
  return sizeRef
}

/**
 * 画布上方还有两层 CSS: 暗角/扫描线覆盖层与空状态文字. 它们必须跟随自定义背景,
 * 否则白色背景会四角发黑、提示文字看不见, 屏幕所见也与导出的图片不一致.
 */
function useSurfaceStyle(): { readonly isCustom: boolean; readonly style: CSSProperties | undefined } {
  const background = useViewStore((state) => state.background)
  return useMemo(() => {
    if (background === null) return { isCustom: false, style: undefined }
    const palette = derivePalette(background, readRenderTheme(document.documentElement))
    return {
      isCustom: true,
      style: { '--stage-bg': palette.background, '--stage-text': palette.text } as CSSProperties,
    }
  }, [background])
}

export function Stage() {
  const surface = useSurfaceStyle()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useCanvasSize(canvasRef)
  const fn = useDocumentStore(selectFunction)
  const pointerHandlers = useStagePointer(canvasRef, sizeRef)
  useStageLoop(canvasRef, sizeRef)

  const enabledCount = fn.components.filter((component) => component.enabled).length
  const summary = `傅立叶函数图形, ${MODE_LABELS[fn.presentationMode]}, ${enabledCount} 个启用的分量. 可在右侧面板用${PARAM_LABELS.amplitude}、${PARAM_LABELS.frequency}、${PARAM_LABELS.phase}控件编辑.`

  return (
    <div className="stage" data-custom-background={surface.isCustom} style={surface.style}>
      <canvas
        ref={canvasRef}
        className="stage__canvas"
        role="img"
        aria-label={summary}
        {...pointerHandlers}
      />
      {enabledCount === 0 && (
        <p className="stage__empty">没有启用的分量. 在面板中添加或启用一个分量, 图形就会出现.</p>
      )}
    </div>
  )
}
