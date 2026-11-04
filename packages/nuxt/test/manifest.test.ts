import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuxtAppManifest } from '../src/app/composables/manifest'

const { manifest, diagnostics } = vi.hoisted(() => ({
  manifest: { id: 'test', timestamp: 1, prerendered: ['/'] },
  diagnostics: {
    NUXT_E5002: vi.fn(),
    NUXT_E5004: vi.fn(() => new Error('Malformed manifest')),
  },
}))

vi.mock('../src/app/nuxt', () => ({ useRuntimeConfig: () => ({ app: { buildId: manifest.id } }) }))
vi.mock('../src/app/diagnostics/manifest', () => ({ manifestDiagnostics: diagnostics }))
vi.mock('#build/nuxt.config.mjs', () => ({ appManifest: true }))

describe('app manifest requests', () => {
  const manifestURL = `/_nuxt/builds/meta/${manifest.id}.json`
  let fetchMock: ReturnType<typeof vi.fn>
  let getAppManifest: () => Promise<NuxtAppManifest>

  beforeEach(async () => {
    // The composable caches its promise at module scope. Give each test a fresh cache.
    vi.resetModules()
    vi.clearAllMocks()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('__TEST_SERVER__', false)
    const composable = await import('../src/app/composables/manifest')
    getAppManifest = composable.getAppManifest
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps shared manifest requests alive without interrupting consumers on cancelled navigation', async () => {
    const windowMock = new EventTarget()
    vi.stubGlobal('window', windowMock)
    // Keep the response pending until after the navigation attempt.
    let resolveResponse!: (response: Response) => void
    const pendingResponse = new Promise<Response>((resolve) => { resolveResponse = resolve })
    fetchMock.mockReturnValueOnce(pendingResponse)

    const request = getAppManifest()
    expect(getAppManifest()).toBe(request)
    expect(fetchMock).toHaveBeenCalledWith(manifestURL, expect.objectContaining({ keepalive: true }))

    // Simulate the user staying on the page after an unsaved-changes prompt.
    windowMock.addEventListener('beforeunload', event => event.preventDefault())
    const navigation = new Event('beforeunload', { cancelable: true })
    expect(windowMock.dispatchEvent(navigation)).toBe(false)
    resolveResponse(Response.json(manifest))

    await expect(request).resolves.toEqual(manifest)
    await expect(getAppManifest()).resolves.toEqual(manifest)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(diagnostics.NUXT_E5002).not.toHaveBeenCalled()
  })

  it('loads the server manifest without accessing window or fetching', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    vi.stubGlobal('window', undefined)
    await expect(getAppManifest()).resolves.toMatchObject(manifest)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['network failure', () => Promise.reject(new TypeError('Load failed'))],
    ['missing manifest', () => Promise.resolve(new Response('', { status: 404 }))],
    ['invalid JSON', () => Promise.resolve(new Response('not json'))],
    ['invalid manifest', () => Promise.resolve(Response.json({ id: manifest.id }))],
  ])('still reports %s and allows retrying', async (_name, response) => {
    fetchMock.mockImplementationOnce(response)

    await expect(getAppManifest()).rejects.toBeInstanceOf(Error)
    expect(diagnostics.NUXT_E5002).toHaveBeenCalledOnce()

    // A failed request must leave the cache clear so the next call can recover.
    fetchMock.mockResolvedValueOnce(Response.json(manifest))
    await expect(getAppManifest()).resolves.toEqual(manifest)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
