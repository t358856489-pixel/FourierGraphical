import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog, Dialog } from './Dialog'

describe('Dialog', () => {
  test('renders nothing while closed', () => {
    render(
      <Dialog title="标题" isOpen={false} onClose={vi.fn()}>
        内容
      </Dialog>,
    )
    expect(screen.queryByText('内容')).not.toBeInTheDocument()
  })

  test('is labelled by its title when open', () => {
    render(
      <Dialog title="导出" isOpen onClose={vi.fn()}>
        内容
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: '导出' })).toBeInTheDocument()
  })

  test('reports Esc (the native cancel event) as a close request', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="导出" isOpen onClose={onClose}>
        内容
      </Dialog>,
    )
    fireEvent(screen.getByRole('dialog'), new Event('cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDialog', () => {
  const setup = () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="替换?"
        message="会丢弃修改"
        confirmLabel="替换"
        isOpen
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    return { onConfirm, onCancel }
  }

  test('confirm and cancel call their own handlers only', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: '替换' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
