import { fireEvent, render, screen } from '@testing-library/react'
import { useKeyboardShortcuts, type Shortcut } from './useKeyboardShortcuts'

function Harness({ shortcuts }: { readonly shortcuts: readonly Shortcut[] }) {
  useKeyboardShortcuts(shortcuts)
  return (
    <>
      <input aria-label="field" />
      <button type="button">btn</button>
      <button type="button" onKeyDown={(event) => event.preventDefault()}>
        handles-keys
      </button>
    </>
  )
}

const setup = () => {
  const space = vi.fn()
  const arrow = vi.fn()
  const undo = vi.fn()
  const redo = vi.fn()
  const shortcuts: Shortcut[] = [
    { key: ' ', run: space },
    { key: 'ArrowRight', run: arrow },
    { key: 'z', mod: true, run: undo },
    { key: 'z', mod: true, shift: true, run: redo },
  ]
  render(<Harness shortcuts={shortcuts} />)
  return { space, arrow, undo, redo }
}

describe('useKeyboardShortcuts', () => {
  test('runs a matching shortcut from the document body', () => {
    const { space } = setup()
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(space).toHaveBeenCalledTimes(1)
  })

  test('distinguishes modifier combinations', () => {
    const { undo, redo } = setup()
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Z', metaKey: true, shiftKey: true })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(1)
  })

  test('never fires while typing in an input', () => {
    const { space, arrow, undo } = setup()
    const field = screen.getByLabelText('field')
    fireEvent.keyDown(field, { key: ' ' })
    fireEvent.keyDown(field, { key: 'ArrowRight' })
    fireEvent.keyDown(field, { key: 'z', ctrlKey: true })
    expect(space).not.toHaveBeenCalled()
    expect(arrow).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
  })

  test('space on a focused button activates the button, not the global shortcut', () => {
    const { space, arrow } = setup()
    const button = screen.getByRole('button', { name: 'btn' })
    fireEvent.keyDown(button, { key: ' ' })
    fireEvent.keyDown(button, { key: 'ArrowRight' })
    expect(space).not.toHaveBeenCalled()
    expect(arrow).toHaveBeenCalledTimes(1)
  })

  test('yields to a control that handled the key itself', () => {
    const { arrow } = setup()
    fireEvent.keyDown(screen.getByRole('button', { name: 'handles-keys' }), { key: 'ArrowRight' })
    expect(arrow).not.toHaveBeenCalled()
  })
})
