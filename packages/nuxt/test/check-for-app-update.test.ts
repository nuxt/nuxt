import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { NuxtApp } from '../src/app/nuxt'

let checkForAppUpdate: typeof import('../src/app/composables/manifest')['checkForAppUpdate']
let checkOutdatedBuild: typeof import('../src/app/plugins/check-outdated-build.client')['default']

const state = vi.hoisted(() => ({
  appManifest: true,
  nuxtApp: undefined as unknown as NuxtApp,
  ready: undefined as undefined | (() => void),
}))

vi.mock('#build/nuxt.config.mjs', () => ({
  get appManifest () { return state.appManifest },
  outdatedBuildInterval: 1000,
}))
vi.mock('../src/app/nuxt', () => ({
  useNuxtApp: () => state.nuxtApp,
  useRuntimeConfig: () => ({ app: { buildId: 'current' } }),
  defineNuxtPlugin: (plugin: unknown) => plugin,
}))
vi.mock('../src/app/composables/ready', () => ({
  onNuxtReady: (callback: () => void) => { state.ready = callback },
}))

const fetchMock = vi.fn<typeof fetch>()
const currentManifest = { id: 'current', timestamp: 1, prerendered: [] }
const newManifest = { id: 'new', timestamp: 2 }

function respond (meta: unknown, status = 200) {
  return new Response(JSON.stringify(meta), { status })
}

function stallCurrentManifest (phase: 'request' | 'body') {
  fetchMock.mockImplementationOnce((_url, options) => {
    if (phase === 'request') {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal!.reason), { once: true })
      })
    }
    return Promise.resolve(new Response(new ReadableStream({
      start (controller) {
        options?.signal?.addEventListener('abort', () => controller.error(options.signal!.reason), { once: true })
      },
    })))
  })
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('__TEST_SERVER__', false)
  state.appManifest = true
  state.ready = undefined
  state.nuxtApp = { hooks: createHooks(), runWithContext: (fn: () => unknown) => fn() } as unknown as NuxtApp
  fetchMock.mockReset().mockImplementation(url => Promise.resolve(respond(String(url).includes('/meta/') ? currentManifest : newManifest)))
  checkForAppUpdate = (await import('../src/app/composables/manifest')).checkForAppUpdate
  checkOutdatedBuild = (await import('../src/app/plugins/check-outdated-build.client')).default
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('checkForAppUpdate', () => {
  it('checks immediately without the polling plugin and emits the existing update hook', async () => {
    const updated = vi.fn()
    state.nuxtApp.hooks.hook('app:manifest:update', updated)

    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/_nuxt\/builds\/latest\.json\?\d+$/), { priority: 'low', signal: expect.any(AbortSignal) })
    expect(updated).toHaveBeenCalledExactlyOnceWith(newManifest)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns undefined without emitting a hook for the current build', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(respond(currentManifest)))
    const updated = vi.fn()
    state.nuxtApp.hooks.hook('app:manifest:update', updated)

    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    expect(updated).not.toHaveBeenCalled()
  })

  it('shares overlapping requests and emits one hook', async () => {
    let complete!: (response: Response) => void
    fetchMock.mockImplementation(url => String(url).includes('/meta/')
      ? Promise.resolve(respond(currentManifest))
      : new Promise((resolve) => { complete = resolve }))
    const updated = vi.fn()
    state.nuxtApp.hooks.hook('app:manifest:update', updated)

    const first = checkForAppUpdate()
    const second = checkForAppUpdate()
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    complete(respond(newManifest))

    await expect(Promise.all([first, second])).resolves.toEqual([newManifest, newManifest])
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(updated).toHaveBeenCalledTimes(1)
  })

  it('checks again after a completed request', async () => {
    await checkForAppUpdate()
    await checkForAppUpdate()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(2)
  })

  it.each([403, 404, 500])('ignores HTTP %i from the latest manifest and allows a retry', async (status) => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockResolvedValueOnce(respond({}, status))
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
  })

  it('ignores network errors and allows a retry', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockRejectedValueOnce(new TypeError('offline'))
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
  })

  it('times out a stalled latest manifest request and allows a retry', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal!.reason), { once: true })
    }))

    const first = checkForAppUpdate()
    const second = checkForAppUpdate()
    let settled = false
    first.then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(29_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
    expect(vi.getTimerCount()).toBe(0)
    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(2)
  })

  it('times out a stalled latest manifest response body', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockImplementationOnce((_url, options) => Promise.resolve(new Response(new ReadableStream({
      start (controller) {
        options?.signal?.addEventListener('abort', () => controller.error(options.signal!.reason), { once: true })
      },
    }))))

    const check = checkForAppUpdate()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(check).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores malformed JSON from the latest manifest', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockResolvedValueOnce(new Response('not json'))
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
  })

  it.each([null, {}, { id: 1, timestamp: 2 }, { id: 'new' }])('ignores invalid latest manifest metadata: %j', async (meta) => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockResolvedValueOnce(respond(meta))
    const updated = vi.fn()
    state.nuxtApp.hooks.hook('app:manifest:update', updated)
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    expect(updated).not.toHaveBeenCalled()
  })

  it('does nothing on the server', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([403, 404])('detects an update when the old manifest returns HTTP %i', async (status) => {
    fetchMock.mockResolvedValueOnce(respond({}, status))
    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
  })

  it('preserves errors fetching the current manifest and allows a retry', async () => {
    fetchMock.mockResolvedValueOnce(respond({}, 500))
    await expect(checkForAppUpdate()).rejects.toMatchObject({ status: 500 })
    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
  })

  it.each(['request', 'body'] as const)('times out a stalled current manifest %s and clears both cached promises', async (phase) => {
    stallCurrentManifest(phase)
    const results = Promise.allSettled([checkForAppUpdate(), checkForAppUpdate()])
    let settled = false
    results.then(() => { settled = true })

    await vi.advanceTimersByTimeAsync(29_999)
    expect(settled).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    await expect(results).resolves.toEqual([
      { status: 'rejected', reason: expect.objectContaining({ name: 'AbortError' }) },
      { status: 'rejected', reason: expect.objectContaining({ name: 'AbortError' }) },
    ])
    expect(vi.getTimerCount()).toBe(0)

    await expect(checkForAppUpdate()).resolves.toEqual(newManifest)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/meta/'))).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does nothing when the app manifest is disabled', async () => {
    state.appManifest = false
    await expect(checkForAppUpdate()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('outdated build polling', () => {
  async function startPolling () {
    await checkOutdatedBuild(state.nuxtApp)
    state.ready!()
  }

  it('waits for the interval, then stops when an update is found', async () => {
    await startPolling()
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('continues polling when the build is unchanged', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(respond(currentManifest)))
    await startPolling()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('stops polling when a manual check finds an update', async () => {
    await startPolling()
    await checkForAppUpdate()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start polling if a manual check finds an update before Nuxt is ready', async () => {
    await checkOutdatedBuild(state.nuxtApp)
    await checkForAppUpdate()
    state.ready!()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shares a request between a manual check and the polling timer', async () => {
    let complete!: (response: Response) => void
    fetchMock.mockImplementation(url => String(url).includes('/meta/')
      ? Promise.resolve(respond(currentManifest))
      : new Promise((resolve) => { complete = resolve }))
    await startPolling()
    const manual = checkForAppUpdate()
    await vi.advanceTimersByTimeAsync(1000)
    complete(respond(newManifest))
    await manual
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('continues polling after a network failure', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockRejectedValueOnce(new TypeError('offline'))
    await startPolling()
    await vi.advanceTimersByTimeAsync(1000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('continues polling after the current manifest fails to load', async () => {
    fetchMock.mockResolvedValueOnce(respond({}, 500))
    await startPolling()
    await vi.advanceTimersByTimeAsync(1000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['request', 'body'] as const)('continues polling after a current manifest %s times out', async (phase) => {
    stallCurrentManifest(phase)
    await startPolling()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/meta/'))).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('continues polling after a latest manifest request times out', async () => {
    fetchMock.mockResolvedValueOnce(respond(currentManifest)).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal!.reason), { once: true })
    }))
    await startPolling()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/latest.json'))).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
