import { useEffect } from 'react'
import { useToastStore, type ToastMessage } from './toastStore'
import './toast.css'

const AUTO_DISMISS_MS = 5000

function Toast({ message }: { readonly message: ToastMessage }) {
  const dismiss = useToastStore((state) => state.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(message.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [dismiss, message.id])

  return (
    <li className={`toast toast--${message.tone}`}>
      <span>{message.text}</span>
      <button type="button" className="toast__close" onClick={() => dismiss(message.id)}>
        <span aria-hidden="true">×</span>
        <span className="visually-hidden">关闭提示</span>
      </button>
    </li>
  )
}

export function ToastRegion() {
  const messages = useToastStore((state) => state.messages)
  return (
    <ul className="toast-region" aria-live="polite" aria-label="提示">
      {messages.map((message) => (
        <Toast key={message.id} message={message} />
      ))}
    </ul>
  )
}
