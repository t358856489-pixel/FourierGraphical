import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberField } from './NumberField'

const range = { min: 0, max: 100, step: 0.5, unit: '' }

const setup = (value = 1) => {
  const onCommit = vi.fn()
  render(<NumberField label="振幅" value={value} range={range} onCommit={onCommit} />)
  return { onCommit, input: screen.getByRole('textbox', { name: '振幅' }) }
}

describe('NumberField', () => {
  test('commits a valid value on Enter', async () => {
    const { input, onCommit } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '2.5{Enter}')
    expect(onCommit).toHaveBeenCalledWith(2.5)
  })

  test('commits on blur', async () => {
    const { input, onCommit } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '7')
    await userEvent.tab()
    expect(onCommit).toHaveBeenCalledWith(7)
  })

  test('rejects text, explains why and restores the last valid value', async () => {
    const { input, onCommit } = setup(1)
    await userEvent.clear(input)
    await userEvent.type(input, 'abc{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('1')
    expect(screen.getByText('请输入数字')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('请输入数字')
  })

  test('rejects out-of-range input and shows the allowed range', async () => {
    const { input, onCommit } = setup(1)
    await userEvent.clear(input)
    await userEvent.type(input, '999{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('1')
    expect(screen.getByText(/0 到 100/)).toBeInTheDocument()
  })

  test('clears the error after the next valid commit', async () => {
    const { input } = setup(1)
    await userEvent.clear(input)
    await userEvent.type(input, 'abc{Enter}')
    await userEvent.clear(input)
    await userEvent.type(input, '3{Enter}')
    expect(screen.queryByText('请输入数字')).not.toBeInTheDocument()
  })

  test('arrow keys step the value and clamp to the range', async () => {
    const { input, onCommit } = setup(99.75)
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')
    expect(onCommit).toHaveBeenLastCalledWith(99.25)
    await userEvent.keyboard('{ArrowUp}')
    expect(onCommit).toHaveBeenLastCalledWith(100)
  })

  test('does not commit when the value is unchanged', async () => {
    const { input, onCommit } = setup(1)
    await userEvent.click(input)
    await userEvent.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  test('follows external value changes', () => {
    const { rerender } = render(
      <NumberField label="振幅" value={1} range={range} onCommit={() => undefined} />,
    )
    rerender(<NumberField label="振幅" value={4} range={range} onCommit={() => undefined} />)
    expect(screen.getByRole('textbox', { name: '振幅' })).toHaveValue('4')
  })
})

describe('NumberField when the owner rejects a value', () => {
  test('falls back to the value it is given instead of keeping the rejected text', async () => {
    // 所有者(如循环区间)可能拒绝一个格式合法的数: value 属性不变, 输入框必须回到它
    render(<NumberField label="循环终点" value={2.5} range={range} onCommit={() => undefined} />)
    const input = screen.getByRole('textbox', { name: '循环终点' })
    await userEvent.clear(input)
    await userEvent.type(input, '1{Enter}')
    expect(input).toHaveValue('2.5')
  })
})
