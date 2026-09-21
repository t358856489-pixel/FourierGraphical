import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastRegion } from './ToastRegion'
import { showError, showInfo, useToastStore } from './toastStore'

beforeEach(() => useToastStore.setState({ messages: [] }))
afterEach(() => vi.useRealTimers())

describe('ToastRegion', () => {
  test('announces messages politely', () => {
    render(<ToastRegion />)
    act(() => showError('保存失败'))
    expect(screen.getByRole('list', { name: '提示' })).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('保存失败')).toBeInTheDocument()
  })

  test('keeps only the three most recent messages', () => {
    render(<ToastRegion />)
    act(() => ['a', 'b', 'c', 'd'].forEach((text) => showInfo(text)))
    expect(screen.queryByText('a')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  test('can be dismissed by hand', async () => {
    render(<ToastRegion />)
    act(() => showInfo('已保存'))
    await userEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(screen.queryByText('已保存')).not.toBeInTheDocument()
  })

  test('dismisses itself after five seconds', () => {
    vi.useFakeTimers()
    render(<ToastRegion />)
    act(() => showInfo('已保存'))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText('已保存')).not.toBeInTheDocument()
  })
})
