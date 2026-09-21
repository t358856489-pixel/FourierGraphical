import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { TransportBar } from './TransportBar'

const playback = () => usePlaybackStore.getState()

beforeEach(resetStores)

describe('TransportBar', () => {
  test('play and pause toggle the state and announce it once', async () => {
    render(<TransportBar />)
    await userEvent.click(screen.getByRole('button', { name: '播放' }))
    expect(playback().isPlaying).toBe(true)
    expect(screen.getByText('正在播放')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '暂停' }))
    expect(playback().isPlaying).toBe(false)
  })

  test('the time readout follows the store and is not a live region', () => {
    render(<TransportBar />)
    const readout = screen.getByTestId('time-readout')
    expect(readout).toHaveTextContent('8.00')
    playback().seek(12.345)
    expect(readout).toHaveTextContent('12.35')
    expect(readout.closest('[aria-live]')).toBeNull()
  })

  test('reset and single steps', async () => {
    render(<TransportBar />)
    await userEvent.click(screen.getByRole('button', { name: '前进一步' }))
    expect(playback().time).toBeCloseTo(8 + 1 / 60, 10)
    await userEvent.click(screen.getByRole('button', { name: '重置到 0 秒' }))
    expect(playback().time).toBe(0)
  })

  test('typing a time jumps there', async () => {
    render(<TransportBar />)
    const field = screen.getByRole('textbox', { name: '跳转到' })
    await userEvent.clear(field)
    await userEvent.type(field, '120{Enter}')
    expect(playback().time).toBe(120)
  })

  test('speed accepts the documented range', () => {
    render(<TransportBar />)
    fireEvent.change(screen.getByRole('slider', { name: '播放速度' }), { target: { value: '5' } })
    expect(playback().speed).toBe(5)
  })

  test('an invalid loop region is rejected with a reason and the previous one kept', async () => {
    render(<TransportBar />)
    await userEvent.click(screen.getByRole('button', { name: '循环' }))
    expect(playback().loop).toEqual({ start: 8, end: 13, enabled: true })

    const end = screen.getByRole('textbox', { name: '循环终点' })
    await userEvent.clear(end)
    await userEvent.type(end, '1{Enter}')
    expect(playback().loop?.end).toBe(13)
    expect(screen.getByRole('alert')).toHaveTextContent('循环终点')
  })
})
