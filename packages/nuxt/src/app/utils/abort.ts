export function isAbortError (err: unknown): err is DOMException {
  return typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError'
}

/** An abort reason as the error a request rejects with; a reason that is not an `Error` becomes an `AbortError`. */
export function toAbortError (reason: unknown): Error {
  return reason instanceof Error ? reason : new DOMException(String(reason ?? 'Aborted'), 'AbortError')
}

export function mergeAbortSignals (signals: Array<AbortSignal | null | undefined>, cleanupSignal: AbortSignal, timeout?: number): AbortSignal {
  const list = signals.filter(s => !!s)
  if (typeof timeout === 'number' && timeout >= 0) {
    const timeoutSignal = AbortSignal.timeout?.(timeout)
    if (timeoutSignal) { list.push(timeoutSignal) }
  }

  // Use native if available
  if (AbortSignal.any) {
    return AbortSignal.any(list)
  }

  // Polyfill
  const controller = new AbortController()

  for (const sig of list) {
    if (sig.aborted) {
      const reason = sig.reason ?? new DOMException('Aborted', 'AbortError')
      try {
        controller.abort(reason)
      } catch {
        controller.abort()
      }
      return controller.signal
    }
  }

  const onAbort = () => {
    const abortedSignal = list.find(s => s.aborted)
    const reason = abortedSignal?.reason ?? new DOMException('Aborted', 'AbortError')
    try {
      controller.abort(reason)
    } catch {
      controller.abort()
    }
  }

  for (const sig of list) {
    sig.addEventListener?.('abort', onAbort, { once: true, signal: cleanupSignal })
  }

  return controller.signal
}
