import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PRESET_BASE_FREQUENCY } from '../../core/ranges'
import { BUILT_IN_SHAPES, findShape } from '../../core/shape/builtins'
import { useDocumentStore } from '../../state/documentStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { ShapeDialog } from './ShapeDialog'
import { thumbnailPath } from './ShapeLibrary'

const doc = () => useDocumentStore.getState()
const open = () => render(<ShapeDialog isOpen onClose={vi.fn()} />)

beforeEach(() => {
  resetStores()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ShapeDialog: shape library', () => {
  test('lists eight named shapes whose thumbnails come from their own paths', () => {
    open()
    const group = screen.getByRole('group', { name: '内置图形' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(BUILT_IN_SHAPES.map((s) => s.name))
    const snow = findShape('snowflake')
    if (!snow) throw new Error('fixture')
    expect(screen.getByTestId('thumb-snowflake').querySelector('path')?.getAttribute('d')).toBe(
      thumbnailPath(snow),
    )
  })

  test('choosing the snowflake applies its default count, switches to 2D, retains the trail and plays from zero', async () => {
    useViewStore.getState().toggle('showGrid')
    useViewStore.getState().setBackground('#ffffff')
    open()
    await userEvent.click(screen.getByRole('button', { name: '雪花' }))
    // 请求 150 项, 但只有振幅不可忽略的项会成为分量(雪花六重对称, 只有 n ≡ 1 (mod 6) 的项有能量)
    const applied = doc().history.present.components.length
    expect(applied).toBeGreaterThan(100)
    expect(applied).toBeLessThanOrEqual(findShape('snowflake')?.defaultCount ?? 0)
    expect(doc().history.present.presentationMode).toBe('drawing2d')
    expect(useViewStore.getState()).toMatchObject({
      showTrail: true,
      trailFade: false,
      trailRetention: 'all',
      showGrid: false,
      background: '#ffffff',
    })
    expect(usePlaybackStore.getState()).toMatchObject({ time: 0, isPlaying: true })
    expect(screen.getByRole('button', { name: '雪花' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('with reduced motion it does not play but shows the finished figure', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    open()
    await userEvent.click(screen.getByRole('button', { name: '心形' }))
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
    expect(usePlaybackStore.getState().time).toBeCloseTo(1 / PRESET_BASE_FREQUENCY, 9)
  })

  test('the count slider spans 2–200 and a drag is a single undo step', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: '五角星' }))
    const steps = doc().history.past.length
    const slider = screen.getByRole('slider', { name: '图形分量个数' })
    expect(slider).toHaveAttribute('min', '2')
    expect(slider).toHaveAttribute('max', '200')
    fireEvent.change(slider, { target: { value: '10' } })
    fireEvent.change(slider, { target: { value: '20' } })
    expect(doc().history.present.components).toHaveLength(20)
    fireEvent.pointerUp(slider)
    expect(doc().history.past).toHaveLength(steps + 1)
  })

  test('asks before overwriting unsaved edits; cancelling keeps them; switching shapes afterwards does not ask again', async () => {
    doc().addComponent()
    const before = doc().history.present
    open()
    await userEvent.click(screen.getByRole('button', { name: '圆' }))
    expect(screen.getByText(/尚未保存的修改都会被丢弃/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(doc().history.present).toBe(before)

    await userEvent.click(screen.getByRole('button', { name: '圆' }))
    await userEvent.click(screen.getByRole('button', { name: '替换' }))
    expect(doc().history.present.presentationMode).toBe('drawing2d')
    await userEvent.click(screen.getByRole('button', { name: '正方形' }))
    expect(screen.queryByText(/尚未保存的修改都会被丢弃/)).not.toBeInTheDocument()
    expect(doc().history.present.components.length).toBeLessThanOrEqual(
      findShape('square')?.defaultCount ?? 0,
    )
    expect(doc().history.present.components.length).toBeGreaterThan(10)
  })
})
