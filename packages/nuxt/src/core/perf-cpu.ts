import { createHook, executionAsyncResource } from 'node:async_hooks'
import type { AsyncHook } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

/** A hook call, which owns the async resources created while its code runs. */
export interface CpuOwner {
  cpuTime: number
  /** Once set, later work by the call's resources is not counted. */
  done: boolean
}

/**
 * Measures how long the main thread runs each hook call's own code, including continuations
 * after `await`, timers and I/O callbacks, by following the async resources each call creates.
 */
export class HookCpuTracker {
  #owner = Symbol('owner')
  #owners = new WeakSet<CpuOwner>()
  #current: CpuOwner | undefined
  #since = 0
  /** For each callback running, its async id and the owner to restore when it ends. */
  #ids: number[] = []
  #previous: Array<CpuOwner | undefined> = []
  #state: 'idle' | 'enabled' | 'disabled' = 'idle'
  #hook?: AsyncHook

  /** Whether hook calls have been tracked, so the timings come from this tracker. */
  get used (): boolean {
    return !!this.#hook
  }

  /**
   * Starts tracking unless the tracker has been disabled, and returns whether it is tracking.
   * Runtimes whose `createHook` does not report promises are left untracked.
   */
  enable (): boolean {
    if (this.#state !== 'idle') { return this.#state === 'enabled' }
    this.#state = 'disabled'
    try {
      const hook = createHook({
        init: (_asyncId, _type, _triggerAsyncId, resource) => {
          if (!this.#current) { return }
          try {
            (resource as Record<symbol, CpuOwner>)[this.#owner] = this.#current
          } catch {
            // an exception thrown from an async hook callback ends the process
          }
        },
        before: (asyncId) => {
          try {
            this.#ids.push(asyncId)
            this.#previous.push(this.#current)
            const owner = (executionAsyncResource() as Record<symbol, CpuOwner | undefined>)[this.#owner]
            this.#switch(this.#owners.has(owner!) ? owner : undefined)
          } catch {
            // an exception thrown from an async hook callback ends the process
          }
        },
        after: (asyncId) => {
          try {
            if (this.#ids.at(-1) === asyncId) {
              this.#ids.pop()
              this.#switch(this.#previous.pop())
              return
            }
            // callbacks that never ended, as after an uncaught exception, are dropped
            const index = this.#ids.lastIndexOf(asyncId)
            if (index === -1) { return }
            this.#switch(this.#previous[index])
            this.#ids.length = index
            this.#previous.length = index
          } catch {
            // an exception thrown from an async hook callback ends the process
          }
        },
      })
      hook.enable()
      const probe = this.createOwner()
      probe.done = true
      this.#current = probe
      const reported = (Promise.resolve() as unknown as Record<symbol, CpuOwner>)[this.#owner] === probe
      this.#current = undefined
      if (!reported) {
        hook.disable()
        return false
      }
      this.#hook = hook
      this.#state = 'enabled'
      return true
    } catch {
      this.#current = undefined
      return false
    }
  }

  disable (): void {
    this.#state = 'disabled'
    this.#hook?.disable()
    this.#current = undefined
    this.#ids.length = 0
    this.#previous.length = 0
  }

  createOwner (): CpuOwner {
    const owner = { cpuTime: 0, done: false }
    this.#owners.add(owner)
    return owner
  }

  /** Runs `fn` as `owner`. */
  run<T> (owner: CpuOwner, fn: () => T): T {
    const previous = this.#current
    this.#switch(owner)
    try {
      return fn()
    } finally {
      this.#switch(previous)
    }
  }

  #switch (next: CpuOwner | undefined) {
    const now = performance.now()
    if (this.#current && !this.#current.done) {
      this.#current.cpuTime += now - this.#since
    }
    this.#since = now
    this.#current = next
  }
}
