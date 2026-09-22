import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePlaybackStore } from '../../state/playbackStore'
import { resetStores } from '../../test/resetStores'
import { ExportDialog } from './ExportDialog'

const support = vi.hoisted(() => ({ value: { supported: true } as { supported: boolean; reason?: string } }))
vi.mock('../../export/videoSupport', () => ({
  detectVideoSupport: () => Promise.resolve(support.value),
}))

const openVideoTab = async () => {
  render(<ExportDialog isOpen onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('tab', { name: '视频' }))
  await screen.findByRole('tabpanel')
}

beforeEach(() => {
  resetStores()
  support.value = { supported: true }
})

describe('ExportDialog', () => {
  test('starts on the image tab', () => {
    render(<ExportDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByRole('tab', { name: '图片' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: '导出图片' })).toBeInTheDocument()
  })

  test('defaults to the interval that yields a ten second video at the current speed', async () => {
    usePlaybackStore.getState().setSpeed(0.5)
    await openVideoTab()
    expect(await screen.findByRole('textbox', { name: '终点' })).toHaveValue('5')
    expect(screen.getByText(/成片时长/)).toHaveTextContent('10.0')
  })

  test('defaults to the loop region when one is set', async () => {
    usePlaybackStore.getState().setLoop({ start: 2, end: 6, enabled: true })
    await openVideoTab()
    expect(await screen.findByRole('textbox', { name: '起点' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: '终点' })).toHaveValue('6')
  })

  test('blocks an output longer than sixty seconds and says why', async () => {
    await openVideoTab()
    const end = await screen.findByRole('textbox', { name: '终点' })
    await userEvent.clear(end)
    await userEvent.type(end, '90{Enter}')
    expect(screen.getByRole('button', { name: '开始导出' })).toBeDisabled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  test('explains why video export is unavailable while image export still works', async () => {
    support.value = { supported: false, reason: '此浏览器不支持 WebCodecs 视频编码.' }
    await openVideoTab()
    expect(await screen.findByRole('status')).toHaveTextContent('不支持 WebCodecs')
    expect(screen.queryByRole('button', { name: '开始导出' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: '图片' }))
    expect(screen.getByRole('button', { name: '导出图片' })).toBeEnabled()
  })
})

describe('exports use the same palette as the stage (feature 002)', () => {
  test('frameInput carries the display options and a theme derived from the chosen background', async () => {
    const { frameInput } = await import('./ExportDialog')
    const { derivePalette } = await import('../../render/palette')
    const { readRenderTheme } = await import('../../render/theme')
    const { useViewStore } = await import('../../state/viewStore')
    useViewStore.getState().setBackground('#ffffff')
    useViewStore.getState().toggle('trailFade')
    useViewStore.getState().toggle('showAxes')

    const input = frameInput()
    expect(input.view).toMatchObject({ background: '#ffffff', trailFade: false, showAxes: false })
    expect(input.theme).toEqual(derivePalette('#ffffff', readRenderTheme(document.documentElement)))
    expect(input.theme.background).toBe('#ffffff')
  })
})
