import { describe, expect, it, vi } from 'vitest'
import { createWaitForModulePlugin, finishConcurrentBuild, handleEarlyRejection } from './build.ts'

function deferred<T = void> () {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, reject, resolve }
}

describe('Nitro build overlap', () => {
  it('starts a final build after prerender when it did not already start', async () => {
    const startFinalBuild = vi.fn(async () => {})
    const onPrerenderComplete = vi.fn()

    await finishConcurrentBuild(Promise.resolve(), () => undefined, startFinalBuild, onPrerenderComplete)

    expect(startFinalBuild).toHaveBeenCalledOnce()
    expect(onPrerenderComplete).toHaveBeenCalledBefore(startFinalBuild)
  })

  it('waits for an overlapping final build when prerender fails', async () => {
    const finalBuild = deferred()
    const prerenderError = new Error('prerender failed')
    const result = finishConcurrentBuild(
      Promise.reject(prerenderError),
      () => finalBuild.promise,
      vi.fn(),
    )

    let settled = false
    void result.finally(() => { settled = true }).catch(() => {})
    await Promise.resolve()
    expect(settled).toBe(false)

    finalBuild.resolve()
    await expect(result).rejects.toBe(prerenderError)
  })

  it('does not start a final build when prerender fails before the overlap begins', async () => {
    const startFinalBuild = vi.fn(async () => {})
    const onPrerenderComplete = vi.fn()
    const prerenderError = new Error('prerender failed')

    await expect(finishConcurrentBuild(
      Promise.reject(prerenderError),
      () => undefined,
      startFinalBuild,
      onPrerenderComplete,
    )).rejects.toBe(prerenderError)
    expect(startFinalBuild).not.toHaveBeenCalled()
    expect(onPrerenderComplete).not.toHaveBeenCalled()
  })

  it('preserves prerender as the primary error when both tasks fail', async () => {
    const prerenderError = new Error('prerender failed')
    const finalBuildError = new Error('final build failed')

    await expect(finishConcurrentBuild(
      Promise.reject(prerenderError),
      () => Promise.reject(finalBuildError),
      vi.fn(),
    )).rejects.toBe(prerenderError)
  })

  it('propagates a final build error after successful prerender', async () => {
    const finalBuildError = new Error('final build failed')

    await expect(finishConcurrentBuild(
      Promise.resolve(),
      () => Promise.reject(finalBuildError),
      vi.fn(),
    )).rejects.toBe(finalBuildError)
  })

  it('waits before loading a dependent module', async () => {
    const dependency = deferred()
    const plugin = createWaitForModulePlugin('test:wait', '#test/module', dependency.promise)
    const load = plugin.load.handler()
    let loaded = false
    void load.then(() => { loaded = true })

    await Promise.resolve()
    expect(loaded).toBe(false)
    expect(plugin.load.order).toBe('pre')
    expect(plugin.load.filter.id.test('#test/module')).toBe(true)
    expect(plugin.load.filter.id.test('#test/module/other')).toBe(false)

    dependency.resolve()
    await expect(load).resolves.toBeUndefined()
    expect(loaded).toBe(true)
  })

  it('propagates dependency errors from the module barrier', async () => {
    const error = new Error('asset generation failed')
    const plugin = createWaitForModulePlugin('test:wait', '#test/module', Promise.reject(error))

    await expect(plugin.load.handler()).rejects.toBe(error)
  })

  it('keeps an eagerly started rejection observable without becoming unhandled', async () => {
    const error = new Error('build failed')
    const task = handleEarlyRejection(Promise.reject(error))

    await Promise.resolve()
    await expect(task).rejects.toBe(error)
  })
})
