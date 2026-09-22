import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { constant, type TrailRetention } from '../../core/types'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { DisplayPanel } from './DisplayPanel'
import { formatRetention } from './formatRetention'

const view = () => useViewStore.getState()
const open = async () => {
  render(<DisplayPanel />)
  await userEvent.click(screen.getByText('画面'))
}
const makeAperiodic = (frequency: number) => {
  const store = useDocumentStore.getState()
  const id = store.history.present.components[0]?.id ?? ''
  store.editTrack(id, 'frequency', () => ({ ok: true, value: constant(frequency) }), 'commit')
}

beforeEach(resetStores)

describe('formatRetention', () => {
  test('uses seconds, minutes and "全部"', () => {
    const samples: TrailRetention[] = [5, 60, 120, 600, 'all']
    expect(samples.map(formatRetention)).toEqual([
      '5 秒',
      '1 分钟',
      '2 分钟',
      '10 分钟',
      '全部',
    ])
  })
})

describe('DisplayPanel', () => {
  // jsdom 不实现 <details> 的键盘切换; 键盘展开由端到端测试覆盖
  test('is a collapsed disclosure', async () => {
    render(<DisplayPanel />)
    expect(screen.getByText('轨迹淡化')).not.toBeVisible()
    await userEvent.click(screen.getByText('画面'))
    expect(screen.getByText('轨迹淡化')).toBeVisible()
  })

  test('the fade switch controls trailFade', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: '轨迹淡化' }))
    expect(view().trailFade).toBe(false)
  })

  test('retention is disabled with an explanation while fading is on', async () => {
    await open()
    const select = screen.getByRole('combobox', { name: '轨迹保留时长' })
    expect(select).toBeDisabled()
    expect(select).toHaveAccessibleDescription(/关闭.*轨迹淡化/)
  })

  test('retention offers the eight documented steps and updates the setting', async () => {
    view().toggle('trailFade')
    await open()
    const select = screen.getByRole('combobox', { name: '轨迹保留时长' })
    expect(select).toBeEnabled()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '5 秒', '10 秒', '30 秒', '1 分钟', '2 分钟', '5 分钟', '10 分钟', '全部',
    ])
    await userEvent.selectOptions(select, '30 秒')
    expect(view().trailRetention).toBe(30)
    await userEvent.selectOptions(select, '全部')
    expect(view().trailRetention).toBe('all')
  })

  test('says when "全部" has reached the ten minute cap', async () => {
    view().toggle('trailFade')
    useDocumentStore.getState().setPresentationMode('drawing2d')
    makeAperiodic(1.23456)
    await open()
    expect(screen.queryByText(/10 分钟保留上限/)).not.toBeInTheDocument()
    act(() => usePlaybackStore.getState().seek(900))
    expect(screen.getByText(/10 分钟保留上限/)).toBeInTheDocument()
  })

  test('says when a fast function forces a shorter retention so the shape stays correct', async () => {
    view().toggle('trailFade')
    useDocumentStore.getState().setPresentationMode('drawing2d')
    makeAperiodic(97.123456)
    act(() => usePlaybackStore.getState().seek(600))
    await open()
    expect(screen.getByText(/频率较高.*实际保留约 \d+ 秒/)).toBeInTheDocument()
  })

  test('shows no status while fading is on', async () => {
    makeAperiodic(97.123456)
    act(() => usePlaybackStore.getState().seek(900))
    await open()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
