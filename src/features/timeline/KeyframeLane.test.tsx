import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { Timeline } from './Timeline'

const store = () => useDocumentStore.getState()
const component = (index = 0) => store().history.present.components[index]
const markers = () => screen.queryAllByRole('button', { name: /关键帧,/ })

const seedAmplitudeRamp = () => {
  const id = component()?.id ?? ''
  store().addKeyframe(id, 'amplitude', 0)
  store().setParamValue(id, 'amplitude', 2, 5, 'commit')
}

beforeEach(resetStores)

describe('KeyframeLane', () => {
  test('renders nothing until a parameter is animated', () => {
    render(<Timeline />)
    expect(markers()).toHaveLength(0)
  })

  test('shows each keyframe as a focusable button named by parameter, time and value', () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    expect(markers()).toHaveLength(2)
    expect(screen.getByRole('button', { name: '分量 1 振幅关键帧, 5.000 秒, 值 2' })).toBeInTheDocument()
  })

  test('hides keyframes of a disabled component', () => {
    seedAmplitudeRamp()
    store().setEnabled(component()?.id ?? '', false)
    render(<Timeline />)
    expect(markers()).toHaveLength(0)
  })

  test('clicking a keyframe selects it, seeks to it and opens the inspector', async () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    await userEvent.click(screen.getByRole('button', { name: /5\.000 秒/ }))
    expect(usePlaybackStore.getState().time).toBe(5)
    expect(screen.getByRole('group', { name: /关键帧 · 分量 1 振幅/ })).toBeInTheDocument()
  })

  test('arrow keys move the keyframe and do not leak to global shortcuts', () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    const marker = screen.getByRole('button', { name: /5\.000 秒/ })
    const notPrevented = fireEvent.keyDown(marker, { key: 'ArrowRight' })
    expect(notPrevented).toBe(false)
    expect(screen.getByRole('button', { name: /5\.100 秒/ })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: /5\.100 秒/ }), { key: 'ArrowLeft', shiftKey: true })
    expect(screen.getByRole('button', { name: /5\.099 秒/ })).toBeInTheDocument()
  })

  test('Delete removes the keyframe; removing the last one restores a fixed value', () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    fireEvent.keyDown(screen.getByRole('button', { name: /5\.000 秒/ }), { key: 'Delete' })
    fireEvent.keyDown(screen.getByRole('button', { name: /0\.000 秒/ }), { key: 'Delete' })
    expect(markers()).toHaveLength(0)
    expect(component()?.amplitude.kind).toBe('constant')
  })

  test('the inspector changes easing and value and deletes', async () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    await userEvent.click(screen.getByRole('button', { name: /0\.000 秒/ }))
    await userEvent.click(screen.getByRole('radio', { name: '缓入缓出' }))
    const value = screen.getByRole('textbox', { name: '值' })
    await userEvent.clear(value)
    await userEvent.type(value, '1.5{Enter}')
    const track = component()?.amplitude
    expect(track?.kind === 'animated' && track.keyframes[0]).toEqual({ time: 0, value: 1.5, easing: 'smooth' })

    await userEvent.click(screen.getByRole('button', { name: '删除关键帧' }))
    expect(markers()).toHaveLength(1)
  })

  test('retiming through the inspector keeps the keyframe selected', async () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    await userEvent.click(screen.getByRole('button', { name: /5\.000 秒/ }))
    const time = screen.getByRole('textbox', { name: '时刻' })
    await userEvent.clear(time)
    await userEvent.type(time, '7{Enter}')
    expect(screen.getByRole('button', { name: /7\.000 秒/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('KeyframeLane pointer drag', () => {
  const laneWidth = 1000
  const dragTo = (clientX: number) => {
    // 真实浏览器里指针事件总是落在"当前"那个标记节点上, 所以每次都重新查询
    const marker = markers().at(-1) as HTMLElement
    const lane = marker.parentElement as HTMLElement
    lane.getBoundingClientRect = () =>
      ({ left: 0, width: laneWidth, top: 0, height: 20, right: laneWidth, bottom: 20, x: 0, y: 0 }) as DOMRect
    fireEvent.pointerMove(marker, { clientX })
  }

  test('keeps following the pointer across many moves and commits one undo step', () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    const steps = store().history.past.length
    fireEvent.pointerDown(markers().at(-1) as HTMLElement, { pointerId: 1 })
    dragTo(600)
    dragTo(700)
    dragTo(800)
    fireEvent.pointerUp(markers().at(-1) as HTMLElement)

    const track = component()?.amplitude
    expect(track?.kind === 'animated' && track.keyframes.at(-1)?.time).toBe(8)
    expect(store().history.past).toHaveLength(steps + 1)
  })

  test('keeps dragging the same keyframe after it crosses another one', () => {
    seedAmplitudeRamp()
    render(<Timeline />)
    fireEvent.pointerDown(markers()[0] as HTMLElement, { pointerId: 1 })
    const first = () => markers()[0] as HTMLElement
    const lane = first().parentElement as HTMLElement
    lane.getBoundingClientRect = () =>
      ({ left: 0, width: laneWidth, top: 0, height: 20, right: laneWidth, bottom: 20, x: 0, y: 0 }) as DOMRect
    fireEvent.pointerMove(first(), { clientX: 300 })
    fireEvent.pointerMove(first(), { clientX: 700 })
    fireEvent.pointerMove(first(), { clientX: 900 })
    fireEvent.pointerUp(first())

    // 被拖动的是原先位于 0 秒的那个关键帧: 它带着自己的值越过了 5 秒处的关键帧
    const track = component()?.amplitude
    const [stayed, dragged] = track?.kind === 'animated' ? track.keyframes : []
    expect([stayed?.time, stayed?.value]).toEqual([5, 2])
    expect(dragged?.time).toBe(9)
    expect(dragged?.value).toBeCloseTo(4 / Math.PI, 10)
  })
})
