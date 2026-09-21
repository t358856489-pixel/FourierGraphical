import { fireEvent, render, screen } from '@testing-library/react'
import { Slider } from './Slider'

const range = { min: 0, max: 5, step: 0.01, unit: '' }

const setup = () => {
  const onInput = vi.fn()
  const onCommit = vi.fn()
  render(<Slider label="振幅" value={1} range={range} onInput={onInput} onCommit={onCommit} />)
  return { onInput, onCommit, slider: screen.getByRole('slider', { name: '振幅' }) }
}

describe('Slider', () => {
  test('is a native range input carrying the range', () => {
    const { slider } = setup()
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '5')
  })

  test('reports every change while dragging and commits once on release', () => {
    const { slider, onInput, onCommit } = setup()
    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '2' } })
    fireEvent.change(slider, { target: { value: '3' } })
    expect(onInput).toHaveBeenCalledTimes(2)
    expect(onInput).toHaveBeenLastCalledWith(3)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(slider)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  test('commits after a keyboard change', () => {
    const { slider, onCommit } = setup()
    fireEvent.change(slider, { target: { value: '1.01' } })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  test('does not commit when nothing changed', () => {
    const { slider, onCommit } = setup()
    fireEvent.pointerDown(slider)
    fireEvent.pointerUp(slider)
    fireEvent.blur(slider)
    expect(onCommit).not.toHaveBeenCalled()
  })

  test('pins the thumb at the end when the value lies beyond the slider range', () => {
    render(
      <Slider label="频率" value={50} range={range} onInput={vi.fn()} onCommit={vi.fn()} />,
    )
    expect(screen.getByRole('slider', { name: '频率' })).toHaveValue('5')
  })
})
