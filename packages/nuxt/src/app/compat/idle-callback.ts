// Polyfills for Safari support
// https://caniuse.com/requestidlecallback
export const requestIdleCallback: Window['requestIdleCallback'] = process.server
  ? (() => {}) as any
  : (globalThis.requestIdleCallback || ((cb) => {
      const start = Date.now()
      const idleDeadline = {
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      }
      return setTimeout(() => { cb(idleDeadline) }, 1)
    }))

export const cancelIdleCallback: Window['cancelIdleCallback'] = process.server
  ? (() => {}) as any
  : (globalThis.cancelIdleCallback || ((id) => { clearTimeout(id) }))
