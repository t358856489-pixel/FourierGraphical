import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { ComponentsPanel } from './ComponentsPanel'

const store = () => useDocumentStore.getState()
const first = () => store().history.present.components[0]

beforeEach(resetStores)

describe('ParamControl keyframes', () => {
  test('the diamond button adds a keyframe at the current time and marks the parameter animated', async () => {
    usePlaybackStore.getState().seek(2)
    render(<ComponentsPanel />)
    await userEvent.click(screen.getByRole('button', { name: /为分量 1 振幅添加关键帧/ }))
    expect(first()?.amplitude.kind).toBe('animated')
    expect(screen.getByRole('button', { name: /分量 1 振幅添加关键帧\(已动画\)/ })).toBeInTheDocument()
  })

  test('an animated control follows the playback time', () => {
    const id = first()?.id ?? ''
    usePlaybackStore.getState().seek(0)
    store().addKeyframe(id, 'amplitude', 0)
    store().setParamValue(id, 'amplitude', 0, 0, 'commit')
    store().setParamValue(id, 'amplitude', 1, 5, 'commit')
    render(<ComponentsPanel />)
    act(() => usePlaybackStore.getState().seek(2.5))
    expect(screen.getByRole('textbox', { name: '分量 1 振幅数值' })).toHaveValue('0.5')
  })

  test('editing an animated parameter at a new time auto-creates a keyframe there', async () => {
    const id = first()?.id ?? ''
    store().addKeyframe(id, 'phase', 0)
    usePlaybackStore.getState().seek(4)
    render(<ComponentsPanel />)
    const field = screen.getByRole('textbox', { name: '分量 1 相位数值' })
    await userEvent.clear(field)
    await userEvent.type(field, '90{Enter}')
    const track = first()?.phase
    expect(track?.kind === 'animated' && track.keyframes.map((k) => k.time)).toEqual([0, 4])
  })

  test('warns about visual aliasing above 30 turns per second', async () => {
    render(<ComponentsPanel />)
    const field = screen.getByRole('textbox', { name: '分量 1 频率数值' })
    await userEvent.clear(field)
    await userEvent.type(field, '45{Enter}')
    expect(screen.getByText(/视觉混叠/)).toBeInTheDocument()
  })
})
