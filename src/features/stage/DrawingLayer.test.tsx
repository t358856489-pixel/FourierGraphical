import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import type { FrameSize } from '../../render/drawFrame'
import { useDocumentStore } from '../../state/documentStore'
import { useDrawingStore } from '../../state/drawingStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { DrawingLayer } from './DrawingLayer'

const sizeRef = createRef<FrameSize>() as React.RefObject<FrameSize>
Object.assign(sizeRef, { current: { width: 600, height: 600, pixelRatio: 1 } })

const drawSquare = (layer: HTMLElement) => {
  fireEvent.pointerDown(layer, { clientX: 100, clientY: 100, pointerId: 1 })
  // 沿四条边插值: 1 px 以内的重复点会被去掉, 所以要真的"走"过去
  const corners: [number, number][] = [
    [100, 100],
    [300, 100],
    [300, 300],
    [100, 300],
    [100, 100],
  ]
  for (let edge = 0; edge < corners.length - 1; edge++) {
    const [x0, y0] = corners[edge] as [number, number]
    const [x1, y1] = corners[edge + 1] as [number, number]
    for (let step = 1; step <= 10; step++) {
      fireEvent.pointerMove(layer, {
        clientX: x0 + ((x1 - x0) * step) / 10,
        clientY: y0 + ((y1 - y0) * step) / 10,
        pointerId: 1,
      })
    }
  }
  fireEvent.pointerUp(layer, { pointerId: 1 })
}

beforeEach(() => {
  resetStores()
  useDrawingStore.getState().exit()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
})
afterEach(() => vi.unstubAllGlobals())

describe('DrawingLayer', () => {
  test('is absent until drawing mode starts', () => {
    render(<DrawingLayer sizeRef={sizeRef} />)
    expect(screen.queryByTestId('drawing-layer')).not.toBeInTheDocument()
  })

  test('drawing a square and releasing converts it into a function', () => {
    useDrawingStore.getState().enter()
    render(<DrawingLayer sizeRef={sizeRef} />)
    drawSquare(screen.getByTestId('drawing-layer'))
    expect(useDrawingStore.getState().lastRaw?.length).toBeGreaterThan(20)
    expect(useDocumentStore.getState().history.present.presentationMode).toBe('drawing2d')
    expect(useDocumentStore.getState().history.present.components.length).toBeGreaterThan(5)
    expect(useDocumentStore.getState().editBase).toBeNull()
  })

  test('a tiny stroke is refused with a message and drawing mode stays on', () => {
    useDrawingStore.getState().enter()
    const before = useDocumentStore.getState().history.present
    render(<DrawingLayer sizeRef={sizeRef} />)
    const layer = screen.getByTestId('drawing-layer')
    fireEvent.pointerDown(layer, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(layer, { clientX: 11, clientY: 11, pointerId: 1 })
    fireEvent.pointerUp(layer, { pointerId: 1 })
    expect(useDocumentStore.getState().history.present).toBe(before)
    expect(useDrawingStore.getState().isActive).toBe(true)
  })

  test('smoothing and count sliders are enabled after a result; a whole drag is one undo step', () => {
    useDrawingStore.getState().enter()
    render(<DrawingLayer sizeRef={sizeRef} />)
    expect(screen.getByRole('slider', { name: '平滑程度' })).toBeDisabled()
    drawSquare(screen.getByTestId('drawing-layer'))
    const steps = useDocumentStore.getState().history.past.length
    const smoothing = screen.getByRole('slider', { name: '平滑程度' })
    fireEvent.change(smoothing, { target: { value: '40' } })
    fireEvent.change(smoothing, { target: { value: '80' } })
    // 拖动中只预览, 松手提交: 整个拖动是一步撤销
    expect(useDocumentStore.getState().history.past).toHaveLength(steps)
    fireEvent.pointerUp(smoothing)
    expect(useDocumentStore.getState().history.past).toHaveLength(steps + 1)
    const count = screen.getByRole('slider', { name: '手绘分量个数' })
    fireEvent.change(count, { target: { value: '8' } })
    fireEvent.pointerUp(count)
    expect(useDocumentStore.getState().history.past).toHaveLength(steps + 2)
    expect(useDocumentStore.getState().history.present.components.length).toBeLessThanOrEqual(8)
  })

  test('clear empties the stroke; exit removes the layer and restores playback', async () => {
    usePlaybackStore.getState().play()
    useDrawingStore.getState().enter()
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
    render(<DrawingLayer sizeRef={sizeRef} />)
    const layer = screen.getByTestId('drawing-layer')
    fireEvent.pointerDown(layer, { clientX: 10, clientY: 10, pointerId: 1 })
    expect(useDrawingStore.getState().stroke).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(useDrawingStore.getState().stroke).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: '退出绘制' }))
    expect(screen.queryByTestId('drawing-layer')).not.toBeInTheDocument()
    expect(usePlaybackStore.getState().isPlaying).toBe(true)
  })
})
