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

  it('shares a low-priority keepalive request and caches the result', async () => {
    let resolveResponse!: (response: Response) => void
    const pendingResponse = new Promise<Response>((resolve) => { resolveResponse = resolve })
    fetchMock.mockReturnValueOnce(pendingResponse)

    const request = getAppManifest()
    expect(getAppManifest()).toBe(request)
    expect(fetchMock).toHaveBeenCalledWith(manifestURL, expect.objectContaining({ priority: 'low', keepalive: true }))
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
    {
      name: 'network failure',
      response: () => Promise.reject(new TypeError('Load failed')),
      expectedError: { message: 'Load failed' },
      malformed: false,
    },
    {
      name: 'missing manifest',
      response: () => Promise.resolve(new Response('', { status: 404 })),
      expectedError: { status: 404 },
      malformed: false,
    },
    {
      name: 'invalid JSON',
      response: () => Promise.resolve(new Response('not json')),
      expectedError: { name: 'SyntaxError' },
      malformed: false,
    },
    {
      name: 'invalid manifest',
      response: () => Promise.resolve(Response.json({ id: manifest.id })),
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

    fetchMock.mockResolvedValueOnce(Response.json(manifest))
    await expect(getAppManifest()).resolves.toEqual(manifest)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
