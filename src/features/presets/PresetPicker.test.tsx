import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDocumentStore } from '../../state/documentStore'
import { resetStores } from '../../test/resetStores'
import { PresetPicker } from './PresetPicker'

const store = () => useDocumentStore.getState()
const components = () => store().history.present.components

beforeEach(resetStores)

describe('PresetPicker', () => {
  test('applies a preset directly when there is nothing unsaved', async () => {
    render(<PresetPicker />)
    await userEvent.click(screen.getByRole('button', { name: '方波' }))
    expect(components()).toHaveLength(5)
    expect(screen.getByRole('button', { name: '方波' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/替换当前函数/)).not.toBeInTheDocument()
  })

  test('dragging the count slider resizes the series as a single undo step', async () => {
    render(<PresetPicker />)
    await userEvent.click(screen.getByRole('button', { name: '方波' }))
    const steps = store().history.past.length
    const slider = screen.getByRole('slider', { name: '预设分量个数' })
    fireEvent.change(slider, { target: { value: '12' } })
    fireEvent.change(slider, { target: { value: '20' } })
    expect(components()).toHaveLength(20)
    fireEvent.pointerUp(slider)
    expect(store().history.past).toHaveLength(steps + 1)
  })

  test('asks before overwriting unsaved edits, and cancelling changes nothing', async () => {
    store().addComponent()
    const before = store().history.present
    render(<PresetPicker />)
    await userEvent.click(screen.getByRole('button', { name: '锯齿波' }))
    expect(screen.getByText(/关键帧和尚未保存的修改都会被丢弃/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(store().history.present).toBe(before)
  })

  test('confirming replaces the components, and the replacement can be undone', async () => {
    store().addComponent()
    const before = store().history.present
    render(<PresetPicker />)
    await userEvent.click(screen.getByRole('button', { name: '三角波' }))
    await userEvent.click(screen.getByRole('button', { name: '替换' }))
    expect(components()).toHaveLength(5)
    store().undo()
    expect(store().history.present).toBe(before)
  })

  test('switching between presets does not ask again', async () => {
    render(<PresetPicker />)
    await userEvent.click(screen.getByRole('button', { name: '方波' }))
    await userEvent.click(screen.getByRole('button', { name: '三角波' }))
    expect(screen.queryByText(/替换当前函数/)).not.toBeInTheDocument()
  })
})
