import { render } from '@testing-library/react'
import { useAnimationFrame } from './useAnimationFrame'

function Harness({ onFrame }: { readonly onFrame: (delta: number) => void }) {
  useAnimationFrame(onFrame)
  return null
}

describe('useAnimationFrame', () => {
  let callbacks: FrameRequestCallback[]
  let cancelled: number[]

  beforeEach(() => {
    callbacks = []
    cancelled = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback))
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => cancelled.push(handle))
  })
  afterEach(() => vi.unstubAllGlobals())

  const fire = (now: number) => callbacks.at(-1)?.(now)

  test('passes the wall-clock delta in seconds, starting from zero', () => {
    const onFrame = vi.fn()
    render(<Harness onFrame={onFrame} />)
    fire(1000)
    fire(1016)
    expect(onFrame.mock.calls.map(([delta]) => delta)).toEqual([0, 0.016])
  })

  test('cancels the pending frame on unmount', () => {
    const { unmount } = render(<Harness onFrame={vi.fn()} />)
    unmount()
    expect(cancelled).toHaveLength(1)
  })
})
