import { create } from 'zustand'

interface ToastState {
  message: string | null
  show(message: string): void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(timer)
    set({ message })
    timer = setTimeout(() => set({ message: null }), 3500)
  }
}))

export const toast = (message: string): void => useToast.getState().show(message)
