import { useRef, type PointerEvent, type RefObject, type WheelEvent } from 'react'
import { boundingRadius, vectorChain } from '../../core/evaluator'
import { findComponent } from '../../core/function'
import { evaluate } from '../../core/keyframes'
import { ZOOM_RANGE } from '../../core/ranges'
import type { Vec2 } from '../../core/types'
import { layoutRegions, type FrameSize } from '../../render/drawFrame'
import { createViewport, type Viewport } from '../../render/viewport'
import { selectFunction, useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useViewStore } from '../../state/viewStore'
import { showError } from '../../ui/toastStore'
import { hitTestLink, pointerToAmplitudePhase } from './vectorDrag'

type Gesture =
  | { kind: 'vector'; componentId: string; wasPlaying: boolean }
  | { kind: 'pan'; lastWorld: Vec2 }

const ZOOM_PER_WHEEL_PIXEL = 0.0015

const currentViewport = (size: FrameSize): Viewport => {
  const fn = selectFunction(useDocumentStore.getState())
  const regions = layoutRegions(fn.presentationMode, size)
  return createViewport(useViewStore.getState(), boundingRadius(fn), regions.epicycles)
}

const pointerIn = (event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): Vec2 => {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

/** 画布指针交互: 拖拽向量端点 (FR-004/004a)、空白处平移与滚轮缩放 (FR-011) */
export const useStagePointer = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  sizeRef: RefObject<FrameSize>,
) => {
  const gesture = useRef<Gesture | null>(null)

  const dragVector = (componentId: string, pointer: Vec2) => {
    const document = useDocumentStore.getState()
    const fn = selectFunction(document)
    const time = usePlaybackStore.getState().time
    const component = findComponent(fn, componentId)
    const link = vectorChain(fn, time).find((candidate) => candidate.componentId === componentId)
    if (!component || !link) return
    const world = currentViewport(sizeRef.current).toWorld(pointer)
    const next = pointerToAmplitudePhase(
      component,
      link.from,
      world,
      time,
      evaluate(component.phase, time),
    )
    document.setParamValue(componentId, 'amplitude', next.amplitude, time, 'preview')
    const result = document.setParamValue(componentId, 'phase', next.phase, time, 'preview')
    if (!result.ok) showError(result.error.message)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pointer = pointerIn(event, canvas)
    const viewport = currentViewport(sizeRef.current)
    const fn = selectFunction(useDocumentStore.getState())
    const playback = usePlaybackStore.getState()
    const hit = hitTestLink(vectorChain(fn, playback.time), pointer, viewport.toScreen)
    canvas.setPointerCapture(event.pointerId)

    if (hit) {
      // 播放中端点在移动, 拖拽期间暂停, 释放后恢复 (FR-004a)
      gesture.current = { kind: 'vector', componentId: hit.componentId, wasPlaying: playback.isPlaying }
      playback.pause()
      useViewStore.getState().hover(hit.componentId)
      return
    }
    gesture.current = { kind: 'pan', lastWorld: viewport.toWorld(pointer) }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const active = gesture.current
    if (!canvas || !active) return
    const pointer = pointerIn(event, canvas)
    if (active.kind === 'vector') {
      dragVector(active.componentId, pointer)
      return
    }
    const view = useViewStore.getState()
    const viewport = currentViewport(sizeRef.current)
    const world = viewport.toWorld(pointer)
    const zoom = view.zoom === 'auto' ? 1 : view.zoom
    const pan = view.zoom === 'auto' ? { x: 0, y: 0 } : view.pan
    view.setZoomPan(zoom, {
      x: pan.x - (world.x - active.lastWorld.x),
      y: pan.y - (world.y - active.lastWorld.y),
    })
  }

  const onPointerUp = () => {
    const active = gesture.current
    gesture.current = null
    if (active?.kind !== 'vector') return
    useDocumentStore.getState().commitEdit()
    useViewStore.getState().hover(null)
    if (active.wasPlaying) usePlaybackStore.getState().play()
  }

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const view = useViewStore.getState()
    const pointer = pointerIn(event, canvas)
    const before = currentViewport(sizeRef.current).toWorld(pointer)
    const currentZoom = view.zoom === 'auto' ? 1 : view.zoom
    const zoom = Math.min(
      ZOOM_RANGE.max,
      Math.max(ZOOM_RANGE.min, currentZoom * Math.exp(-event.deltaY * ZOOM_PER_WHEEL_PIXEL)),
    )
    const pan = view.zoom === 'auto' ? { x: 0, y: 0 } : view.pan
    view.setZoomPan(zoom, pan)
    // 以指针为中心缩放: 让指针下的世界点保持不动
    const after = currentViewport(sizeRef.current).toWorld(pointer)
    view.setZoomPan(zoom, { x: pan.x + before.x - after.x, y: pan.y + before.y - after.y })
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel }
}
