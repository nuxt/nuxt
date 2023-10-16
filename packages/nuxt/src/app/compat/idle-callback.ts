// Polyfills for Safari support
// https://caniuse.com/requestidlecallback
export const requestIdleCallback: Window['requestIdleCallback'] = import.meta.server
  ? (() => {}) as any
  : (globalThis.requestIdleCallback || ((cb) => {
      const start = Date.now()
      const idleDeadline = {
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      }
      return setTimeout(() => { cb(idleDeadline) }, 1)
    }))

export const cancelIdleCallback: Window['cancelIdleCallback'] = import.meta.server
  ? (() => {}) as any
  : (globalThis.cancelIdleCallback || ((id) => { clearTimeout(id) }))
