import { useEffect, useRef, type PointerEvent, type RefObject } from 'react'
import { MAX_COMPONENTS } from '../../core/ranges'
import type { Range } from '../../core/types'
import type { FrameSize } from '../../render/drawFrame'
import { useDocumentStore } from '../../state/documentStore'
import { useDrawingStore } from '../../state/drawingStore'
import { Slider } from '../../ui/Slider'
import { showError } from '../../ui/toastStore'
import './drawing-layer.css'

const SMOOTHING_RANGE: Range = { min: 0, max: 100, step: 1, unit: '' }
const COUNT_RANGE: Range = { min: 2, max: MAX_COMPONENTS, step: 1, unit: '' }

interface DrawingLayerProps {
  readonly sizeRef: RefObject<FrameSize>
}

/** 画笔迹的第二层画布; 不进入 drawFrame, 退出绘制模式即消失 */
function StrokeCanvas({ sizeRef }: DrawingLayerProps) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const stroke = useDrawingStore((state) => state.stroke)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { width, height, pixelRatio } = sizeRef.current
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (stroke.length < 2) return
    ctx.strokeStyle = getComputedStyle(canvas).color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
  }, [stroke, sizeRef])

  return <canvas ref={ref} className="drawing-layer__canvas" aria-hidden="true" />
}

export function DrawingLayer({ sizeRef }: DrawingLayerProps) {
  const isActive = useDrawingStore((state) => state.isActive)
  const smoothing = useDrawingStore((state) => state.smoothing)
  const count = useDrawingStore((state) => state.count)
  const hasResult = useDrawingStore((state) => state.lastRaw !== null)
  const { append, clear, exit, finish, setSmoothing, setCount } = useDrawingStore.getState()
  const commitEdit = useDocumentStore((state) => state.commitEdit)
  const isDown = useRef(false)
  if (!isActive) return null

  const pointIn = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDown.current) return
    // 合并事件保留全部采样点, 快速划过时轮廓也完整
    const native = event.nativeEvent as globalThis.PointerEvent & {
      getCoalescedEvents?: () => globalThis.PointerEvent[]
    }
    const events = native.getCoalescedEvents?.() ?? []
    if (events.length === 0) return append(pointIn(event))
    const bounds = event.currentTarget.getBoundingClientRect()
    for (const e of events) append({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
  }

  const onPointerUp = () => {
    if (!isDown.current) return
    isDown.current = false
    const { width, height } = sizeRef.current
    const result = finish(Math.min(width, height) || 1)
    if (!result.ok) showError(result.error.message)
  }

  return (
    <div
      className="drawing-layer"
      data-testid="drawing-layer"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        isDown.current = true
        clear()
        append(pointIn(event))
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <StrokeCanvas sizeRef={sizeRef} />
      <div
        className="drawing-layer__tools"
        role="toolbar"
        aria-label="手绘工具"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="nameplate">手绘</span>
        <div className="drawing-layer__field">
          <span aria-hidden="true">平滑程度</span>
          <Slider
            label="平滑程度"
            value={smoothing}
            range={SMOOTHING_RANGE}
            onInput={setSmoothing}
            onCommit={commitEdit}
            disabled={!hasResult}
          />
        </div>
        <div className="drawing-layer__field">
          <span aria-hidden="true">分量个数</span>
          <Slider
            label="手绘分量个数"
            value={count}
            range={COUNT_RANGE}
            onInput={setCount}
            onCommit={commitEdit}
            disabled={!hasResult}
          />
        </div>
        <button type="button" className="button" onClick={clear}>
          清除
        </button>
        <button type="button" className="button button--primary" onClick={exit}>
          退出绘制
        </button>
      </div>
    </div>
  )
}
