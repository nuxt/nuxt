export const requestIdleCallback: Window['requestIdleCallback'] = import.meta.server
  ? (() => {}) as any
  : globalThis.requestIdleCallback

export const cancelIdleCallback: Window['cancelIdleCallback'] = import.meta.server
  ? (() => {}) as any
  : globalThis.cancelIdleCallback
