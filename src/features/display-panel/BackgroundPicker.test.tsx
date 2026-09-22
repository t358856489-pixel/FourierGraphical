import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useViewStore } from '../../state/viewStore'
import { resetStores } from '../../test/resetStores'
import { BackgroundPicker } from './BackgroundPicker'

const background = () => useViewStore.getState().background

beforeEach(resetStores)

describe('BackgroundPicker', () => {
  test('offers four named presets and marks the current one', async () => {
    render(<BackgroundPicker />)
    for (const name of ['默认深色', '纯黑', '纯白', '浅米色']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '默认深色' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '纯白' }))
    expect(background()).toBe('#ffffff')
    expect(screen.getByRole('button', { name: '纯白' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the native colour input sets the background', () => {
    render(<BackgroundPicker />)
    fireEvent.change(screen.getByLabelText('取色'), { target: { value: '#336699' } })
    expect(background()).toBe('#336699')
  })

  test('a typed hex value is normalised', async () => {
    render(<BackgroundPicker />)
    const field = screen.getByRole('textbox', { name: '十六进制颜色值' })
    await userEvent.clear(field)
    await userEvent.type(field, '#FFF{Enter}')
    expect(background()).toBe('#ffffff')
    expect(field).toHaveValue('#ffffff')
  })

  test('an invalid value is explained and the previous background kept', async () => {
    useViewStore.getState().setBackground('#123456')
    render(<BackgroundPicker />)
    const field = screen.getByRole('textbox', { name: '十六进制颜色值' })
    await userEvent.clear(field)
    await userEvent.type(field, 'red{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('#RRGGBB')
    expect(background()).toBe('#123456')
    expect(field).toHaveValue('#123456')
  })

  test('restore default clears the custom background and is disabled when already default', async () => {
    render(<BackgroundPicker />)
    const restore = screen.getByRole('button', { name: '恢复默认' })
    expect(restore).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '纯黑' }))
    await userEvent.click(restore)
    expect(background()).toBeNull()
  })
})
