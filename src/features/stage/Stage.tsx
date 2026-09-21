import { useEffect, useRef } from 'react'
import { PARAM_LABELS } from '../../core/ranges'
import type { FrameSize } from '../../render/drawFrame'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
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

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useCanvasSize(canvasRef)
  const fn = useDocumentStore(selectFunction)
  const pointerHandlers = useStagePointer(canvasRef, sizeRef)
  useStageLoop(canvasRef, sizeRef)

  const enabledCount = fn.components.filter((component) => component.enabled).length
  const summary = `傅立叶函数图形, ${MODE_LABELS[fn.presentationMode]}, ${enabledCount} 个启用的分量. 可在右侧面板用${PARAM_LABELS.amplitude}、${PARAM_LABELS.frequency}、${PARAM_LABELS.phase}控件编辑.`

  return (
    <div className="stage">
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
