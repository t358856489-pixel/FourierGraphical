import { fireEvent, render, screen } from '@testing-library/react'
import { createDefaultFunction, updateTrack } from '../../core/function'
import { animated } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { latestKeyframeTime, Timeline } from './Timeline'

beforeEach(resetStores)

const scrubber = () => screen.getByRole('slider', { name: '时间轴' })

describe('Timeline', () => {
  test('spans at least ten seconds', () => {
    render(<Timeline />)
    expect(scrubber()).toHaveAttribute('max', '10')
  })

  test('grows with the reached time, the loop end and the latest keyframe', () => {
    usePlaybackStore.getState().seek(42)
    const { rerender } = render(<Timeline />)
    expect(scrubber()).toHaveAttribute('max', '42')

    usePlaybackStore.getState().setLoop({ start: 0, end: 55, enabled: false })
    rerender(<Timeline />)
    expect(scrubber()).toHaveAttribute('max', '55')
  })

  test('latestKeyframeTime finds the last keyframe across all tracks', () => {
    const fn = createDefaultFunction()
    const id = fn.components[0]?.id ?? ''
    const edited = updateTrack(
      fn,
      id,
      'phase',
      animated([
        { time: 1, value: 0, easing: 'linear' },
        { time: 70, value: 90, easing: 'linear' },
      ]),
    )
    expect(latestKeyframeTime(fn)).toBe(0)
    expect(latestKeyframeTime(edited)).toBe(70)
    useDocumentStore.getState().loadFunction(edited, false)
    render(<Timeline />)
    expect(scrubber()).toHaveAttribute('max', '70')
  })

  test('scrubbing seeks', () => {
    render(<Timeline />)
    fireEvent.change(scrubber(), { target: { value: '3.5' } })
    expect(usePlaybackStore.getState().time).toBe(3.5)
    expect(scrubber()).toHaveAttribute('aria-valuetext', '3.50 秒')
  })
})
