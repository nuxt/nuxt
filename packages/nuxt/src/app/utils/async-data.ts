import type { AsyncDataHandlerContext, AsyncDataMiddleware } from '../composables/asyncData'
import { mergeAbortSignals, toAbortError } from './abort'

/**
 * Run a handler through its middleware, the first entry being the outermost. The returned promise
 * rejects as soon as one of `signals` aborts or `timeout` elapses, without waiting for the handler.
 */
export function runAsyncDataHandler<ResT> (
  handler: (ctx: AsyncDataHandlerContext) => ResT | Promise<ResT>,
  middleware: AsyncDataMiddleware<ResT>[] | undefined,
  signals: Array<AbortSignal | null | undefined>,
  timeout?: number,
): Promise<ResT> {
  return new Promise<ResT>((resolve, reject) => {
    const cleanupController = new AbortController()

    let signal: AbortSignal

    try {
      signal = mergeAbortSignals(signals, cleanupController.signal, timeout)
    } catch (err) {
      // nothing listens to the signals yet, so there is nothing to clean up
      return reject(err)
    }

    // cleaning up as the promise settles, rather than in a `finally`, keeps the caller's `then` on the same tick
    const settle = <V>(fn: (value: V) => void) => (value: V) => {
      cleanupController.abort()
      fn(value)
    }

    const onResolve = settle(resolve)
    const onReject = settle(reject)

    const onAbort = () => onReject(toAbortError(signal.reason))

    if (signal.aborted) {
      return onAbort()
    }

    signal.addEventListener('abort', onAbort, { once: true, signal: cleanupController.signal })

    const ctx: AsyncDataHandlerContext = { signal }

    let run = () => Promise.resolve(handler(ctx))

    for (let i = (middleware?.length ?? 0) - 1; i >= 0; i--) {
      const fn = middleware![i]!
      const next = run

      run = () => Promise.resolve(fn(next, ctx))
    }

    try {
      run().then(onResolve, onReject)
    } catch (err) {
      onReject(err)
    }
  })
}
