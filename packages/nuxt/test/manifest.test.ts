import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuxtAppManifest } from '../src/app/composables/manifest'

const { manifest, diagnostics, fetchMock } = vi.hoisted(() => ({
  manifest: { id: 'test', timestamp: 1, prerendered: ['/'] },
  diagnostics: {
    NUXT_E5002: vi.fn(),
    NUXT_E5004: vi.fn(() => new Error('Malformed manifest')),
  },
  fetchMock: vi.fn(),
}))

vi.mock('../src/app/nuxt', () => ({ useRuntimeConfig: () => ({ app: { buildId: manifest.id } }) }))
vi.mock('../src/app/diagnostics/manifest', () => ({ manifestDiagnostics: diagnostics }))
vi.mock('#build/nuxt.config.mjs', () => ({ appManifest: true }))
vi.mock('#build/fetch', () => ({ $fetch: fetchMock }))

describe('app manifest requests', () => {
  const manifestURL = `/_nuxt/builds/meta/${manifest.id}.json`
  let getAppManifest: () => Promise<NuxtAppManifest>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('__TEST_SERVER__', false)
    const composable = await import('../src/app/composables/manifest')
    getAppManifest = composable.getAppManifest
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shares a keepalive request and caches the result', async () => {
    let resolveResponse!: (response: NuxtAppManifest) => void
    const pendingResponse = new Promise<NuxtAppManifest>((resolve) => { resolveResponse = resolve })
    fetchMock.mockReturnValueOnce(pendingResponse)

    const request = getAppManifest()
    expect(getAppManifest()).toBe(request)
    expect(fetchMock).toHaveBeenCalledWith(manifestURL, expect.objectContaining({ keepalive: true }))
    resolveResponse(manifest)

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
    {
      name: 'network failure',
      response: () => Promise.reject(new TypeError('Load failed')),
      expectedError: { message: 'Load failed' },
      malformed: false,
    },
    {
      name: 'missing manifest',
      response: () => Promise.reject(Object.assign(new Error('Not Found'), { status: 404 })),
      expectedError: { status: 404 },
      malformed: false,
    },
    {
      name: 'invalid manifest',
      response: () => Promise.resolve({ id: manifest.id }),
      expectedError: { message: 'Malformed manifest' },
      malformed: true,
    },
  ])('still reports $name and allows retrying', async ({ response, expectedError, malformed }) => {
    fetchMock.mockImplementationOnce(response)

    const request = getAppManifest()
    await expect(request).rejects.toBeInstanceOf(Error)
    await expect(request).rejects.toMatchObject(expectedError)
    expect(diagnostics.NUXT_E5002).toHaveBeenCalledOnce()
    expect(diagnostics.NUXT_E5004).toHaveBeenCalledTimes(malformed ? 1 : 0)

    fetchMock.mockResolvedValueOnce(manifest)
    await expect(getAppManifest()).resolves.toEqual(manifest)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
