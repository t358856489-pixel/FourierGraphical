import { useEffect, useId, useRef, type ReactNode } from 'react'
import './dialog.css'

interface DialogProps {
  readonly title: string
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly children: ReactNode
}

/** 基于原生 <dialog>: 焦点陷阱、Esc 关闭与背景惰性由浏览器提供 */
export function Dialog({ title, isOpen, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      // jsdom 未实现 showModal
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  if (!isOpen) return null
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      {children}
    </dialog>
  )
}

interface ConfirmDialogProps {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly isOpen: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog title={props.title} isOpen={props.isOpen} onClose={props.onCancel}>
      <p className="dialog__message">{props.message}</p>
      <div className="dialog__actions">
        <button type="button" className="button" onClick={props.onCancel}>
          取消
        </button>
        <button type="button" className="button button--primary" onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
