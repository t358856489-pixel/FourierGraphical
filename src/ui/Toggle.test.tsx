import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  test('exposes its state and reports the opposite on click', async () => {
    const onChange = vi.fn()
    render(<Toggle label="网格" pressed onChange={onChange} />)
    const button = screen.getByRole('button', { name: '网格' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
