import type { ScBridge } from '../shared/types'

declare global {
  interface Window {
    sc: ScBridge
  }
}
