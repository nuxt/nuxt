import { queuePostFlushCb } from 'vue'

export interface DebounceTickOptions {
  /**
   * Call `fn` immediately on the leading edge, instead of waiting for the next flush.
   * @default false
   */
  readonly leading?: boolean
}

/**
 * Debounce an async function so that repeated calls within the same tick are
 * collapsed into a single call (plus a trailing call if arguments arrived
 * while the debounced call was still pending).
 *
 * Adapted from https://github.com/unjs/perfect-debounce with the timeout
 * replaced by Vue's post-flush callback queue.
 */
export function debounceTick<ArgumentsT extends unknown[], ReturnT> (
  fn: (...args: ArgumentsT) => PromiseLike<ReturnT> | ReturnT,
  options: DebounceTickOptions = {},
): (...args: ArgumentsT) => Promise<ReturnT> {
  // Last result for leading value
  let leadingValue: PromiseLike<ReturnT> | ReturnT

  // Whether a post-flush callback is currently queued
  let active = false

  // Promises to be resolved when debounce is finished
  let resolveList: Array<(val: ReturnT | PromiseLike<ReturnT>) => void> = []

  // Keep state of currently resolving promise
  let currentPromise: Promise<ReturnT> | undefined

  // Trailing call info
  let trailingArgs: ArgumentsT | undefined

  const applyFn = (_this: unknown, args: ArgumentsT): Promise<ReturnT> => {
    const promise = _applyPromised(fn, _this, args)
    currentPromise = promise
    promise.finally(() => {
      currentPromise = undefined
      if (trailingArgs && !active) {
        const args = trailingArgs
        trailingArgs = undefined
        applyFn(_this, args)
      }
    })
    return promise
  }

  return function (this: unknown, ...args: ArgumentsT): Promise<ReturnT> {
    trailingArgs = args

    if (currentPromise) {
      return currentPromise
    }
    return new Promise<ReturnT>((resolve) => {
      const shouldCallNow = options.leading && !active

      // Unlike perfect-debounce's sliding timeout, which must be cancelled and
      // re-armed on every call to push the deadline out, our deadline is fixed:
      // the window always ends at the next post-flush, no matter how many calls
      // arrive before it. So the callback is queued once per window
      if (!active) {
        active = true
        queuePostFlushCb(() => {
          active = false
          const flushArgs = trailingArgs ?? args
          trailingArgs = undefined
          const promise = options.leading ? leadingValue : applyFn(this, flushArgs)
          for (const _resolve of resolveList) {
            _resolve(promise)
          }
          resolveList = []
        })
      }

      if (shouldCallNow) {
        leadingValue = applyFn(this, args)
        resolve(leadingValue)
      } else {
        resolveList.push(resolve)
      }
    })
  }
}

async function _applyPromised<ArgumentsT extends unknown[], ReturnT> (
  fn: (...args: ArgumentsT) => PromiseLike<ReturnT> | ReturnT,
  _this: unknown,
  args: ArgumentsT,
): Promise<ReturnT> {
  const result = await fn.apply(_this, args)
  return result
}
