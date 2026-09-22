import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { StageToolbar } from './StageToolbar'

beforeEach(resetStores)

describe('StageToolbar display toggles', () => {
  test('grid and axes are separate switches, both on by default', () => {
    render(<StageToolbar />)
    const group = screen.getByRole('group', { name: '显示元素' })
    const names = within(group)
      .getAllByRole('button', { pressed: true })
      .map((button) => button.textContent)
    expect(names).toEqual(['向量', '圆', '轨迹', '网格', '坐标轴'])
  })

  test('the axes switch changes only the axes', async () => {
    render(<StageToolbar />)
    await userEvent.click(screen.getByRole('button', { name: '坐标轴' }))
    expect(useViewStore.getState()).toMatchObject({ showAxes: false, showGrid: true })
    expect(screen.getByRole('button', { name: '坐标轴' })).toHaveAttribute('aria-pressed', 'false')
  })
})
