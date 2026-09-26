import { joinURL } from 'ufo'
import { vi } from 'vitest'
import { createNuxtRenderer } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'
import type { NuxtRendererOptions } from '../../packages/nuxt/src/runtime/server/renderer/index.ts'

export type RendererEvent = Parameters<ReturnType<typeof createNuxtRenderer>['fetch']>[0]

export const BUILD_ASSETS_DIR = '/_custom-assets/'

const runtimeConfig = {
  app: { baseURL: '/', buildAssetsDir: BUILD_ASSETS_DIR, cdnURL: '', buildId: 'standalone' },
  public: { greeting: 'hello from runtime config' },
} as unknown as ReturnType<NuxtRendererOptions['runtimeConfig']>

export const options: NuxtRendererOptions = {
  runtimeConfig: () => runtimeConfig,
  buildAssetsURL: (...path) => joinURL(BUILD_ASSETS_DIR, ...path),
  publicAssetsURL: (...path) => joinURL('/', ...path),
  getRouteRules: () => ({ ssr: true }),
  hooks: () => ({ callHook: () => {} }),
  createResponse: (body, init) => new Response(body, init),
  // h3 and `nuxt/server` both report `HTTPError` as the name, which is how an error the app
  // raised is told apart from one that reached the response by accident
  createError: init => Object.assign(new Error(init.statusText), init, { name: 'HTTPError' }),
}

export function createEvent (path: string): RendererEvent {
  const url = new URL(path, 'http://localhost')
  return {
    req: new Request(url),
    url,
    res: { headers: new Headers() },
    context: {},
  } as unknown as RendererEvent
}

/** Render `path` through a renderer built from {@link options}, with a spy for the error sink. */
export function render (path: string, overrides?: Partial<NuxtRendererOptions>, event = createEvent(path)) {
  const captureError = vi.fn<NonNullable<NuxtRendererOptions['captureError']>>()
  const renderer = createNuxtRenderer({ ...options, captureError, ...overrides })
  return renderer.fetch(event).then(async response => ({ response, html: await response.text(), captureError }))
}
