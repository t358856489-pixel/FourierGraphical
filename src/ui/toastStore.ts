import { create } from 'zustand'

export interface ToastMessage {
  readonly id: number
  readonly text: string
  readonly tone: 'info' | 'error'
}

interface ToastState {
  readonly messages: readonly ToastMessage[]
  readonly push: (text: string, tone?: ToastMessage['tone']) => void
  readonly dismiss: (id: number) => void
}

const MAX_VISIBLE = 3
let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  messages: [],
  push: (text, tone = 'info') =>
    set((state) => ({
      messages: [...state.messages, { id: nextId++, text, tone }].slice(-MAX_VISIBLE),
    })),
  dismiss: (id) =>
    set((state) => ({ messages: state.messages.filter((message) => message.id !== id) })),
}))

export const showError = (text: string): void => useToastStore.getState().push(text, 'error')
export const showInfo = (text: string): void => useToastStore.getState().push(text, 'info')
