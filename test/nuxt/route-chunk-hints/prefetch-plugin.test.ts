import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NuxtApp } from '#app/nuxt'

const preloadHints = {
  preloadLayoutChunks: vi.fn((_layout: string) => Promise.resolve(true)),
  preloadRouteChunks: vi.fn(() => Promise.resolve(true)),
  warmRouteChunkHints: vi.fn(),
  onFailedPreload: vi.fn((_listener: () => void) => {}),
}

const reloadNuxtApp = vi.fn()

interface AsyncLayout { __asyncLoader: () => Promise<unknown>, __asyncResolved?: unknown }

/**
 * Set the plugin up on an app of its own. On the app of the test environment, the plugin that is
 * already installed would schedule the same work first and own it. The plugin and the layouts are
 * loaded afresh, so that every test starts from a layout that has not loaded.
 */
async function installPlugin (routeComponents: unknown[] = []) {
  vi.resetModules()
  vi.doMock('#app/internal/preload-hints', () => preloadHints)
  vi.doMock('#app/composables/chunk', () => ({ reloadNuxtApp }))
  const guards: Array<(to: { path: string, fullPath: string }, from: { path: string }) => unknown> = []
  // islands are only enabled in an app that has server components or pages
  vi.doMock('#build/nuxt.config.mjs', async importOriginal => ({
    ...await importOriginal<Record<string, unknown>>(),
    componentIslands: true,
  }))
  vi.doMock('#app/composables/router', async importOriginal => ({
    ...await importOriginal<Record<string, unknown>>(),
    useRouter: () => ({
      beforeEach: (guard: (typeof guards)[number]) => {
        guards.push(guard)
        return () => { guards.splice(guards.indexOf(guard), 1) }
      },
      resolve: () => ({
        meta: { layout: 'default' },
        matched: routeComponents.map(component => ({ components: { default: component } })),
      }),
    }),
  }))
  const [{ default: plugin }, { default: layouts }] = await Promise.all([
    import('../../../packages/nuxt/src/pages/runtime/plugins/prefetch.client'),
    import('#build/layouts.mjs'),
  ])

  const hooks = new Map<string, (...args: unknown[]) => unknown>()
  const work: unknown[] = []
  await plugin.setup!({
    hooks: { hook: (name: string, handler: (...args: unknown[]) => unknown) => { hooks.set(name, handler) } },
    _prefetch: { schedule: (task: { run: (signal: AbortSignal) => unknown }) => { work.push(task.run(new AbortController().signal)) } },
  } as unknown as NuxtApp)

  return {
    mount: () => hooks.get('app:mounted')!(),
    navigate: (fullPath: string, from = '/') => guards.map(guard => guard({ path: fullPath.replace(/[?#].*$/, ''), fullPath }, { path: from })),
    layout: layouts.default as unknown as AsyncLayout,
    async prefetch (url: string) {
      await hooks.get('link:prefetch')!(url)
      await Promise.all(work)
    },
  }
}

function withConnection (connection: { saveData?: boolean, effectiveType?: string }) {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
}

afterEach(() => {
  vi.doUnmock('#app/internal/preload-hints')
  vi.doUnmock('#app/composables/chunk')
  vi.doUnmock('#build/nuxt.config.mjs')
  vi.doUnmock('#app/composables/router')
  vi.clearAllMocks()
  preloadHints.preloadLayoutChunks.mockImplementation(() => Promise.resolve(true))
  delete (navigator as { connection?: unknown }).connection
})

describe('prefetching a link with `experimental.routeChunkHints`', () => {
  it('fetches the chunks of its layout without evaluating it', async () => {
    const { prefetch, layout } = await installPlugin()

    await prefetch('/destination')
    expect(preloadHints.preloadLayoutChunks).toHaveBeenCalledExactlyOnceWith('default')
    expect(layout.__asyncResolved).toBeFalsy()
  })

  it('fetches nothing for a layout that has loaded', async () => {
    const { prefetch, layout } = await installPlugin()
    await layout.__asyncLoader()

    await prefetch('/destination')
    expect(preloadHints.preloadLayoutChunks).not.toHaveBeenCalled()
  })

  it('loads its layout in a build without hints', async () => {
    preloadHints.preloadLayoutChunks.mockImplementation(() => Promise.resolve(false))
    const { prefetch, layout } = await installPlugin()

    await prefetch('/destination')
    expect(layout.__asyncResolved).toBeTruthy()
  })
})

describe('prefetching a link to a server page with `experimental.routeChunkHints`', () => {
  it('runs the loader of the server page, and of no other route component', async () => {
    const prefetchIsland = vi.fn()
    const serverPage = Object.assign(vi.fn(() => Promise.resolve({ default: { __nuxt_prefetch: prefetchIsland } })), { __nuxt_module: false })
    const hinted = Object.assign(vi.fn(), { __nuxt_module: 'page-key' })
    const unknown = vi.fn()
    const { prefetch } = await installPlugin([serverPage, hinted, unknown, undefined])

    await prefetch('/destination')
    expect(serverPage).toHaveBeenCalledTimes(1)
    expect(prefetchIsland).toHaveBeenCalledTimes(1)
    expect(hinted).not.toHaveBeenCalled()
    expect(unknown).not.toHaveBeenCalled()
  })
})

describe('navigating with `experimental.routeChunkHints`', () => {
  it('loads the destination in a new document once a preload has failed', async () => {
    const { mount, navigate } = await installPlugin()
    mount()

    expect(navigate('/first')).toHaveLength(1)
    expect(reloadNuxtApp).not.toHaveBeenCalled()

    preloadHints.onFailedPreload.mock.calls[0]![0]()
    const [pending, ...others] = navigate('/second?query=1')
    expect(others).toEqual([])
    const settled = vi.fn()
    void (pending as Promise<void>).then(settled, settled)
    await new Promise(resolve => setTimeout(resolve))
    expect(settled).not.toHaveBeenCalled()
    expect(reloadNuxtApp).toHaveBeenCalledExactlyOnceWith({ path: '/second?query=1', persistState: true, force: true })
  })

  it('still navigates within the page once a preload has failed', async () => {
    const { navigate } = await installPlugin()
    preloadHints.onFailedPreload.mock.calls[0]![0]()

    expect(navigate('/page#section', '/page')).toEqual([undefined])
    expect(navigate('/page?query=1', '/page')).toEqual([undefined])
    expect(reloadNuxtApp).not.toHaveBeenCalled()
  })
})

describe('the prefetch plugin', () => {
  it('fetches the hints when the app starts, ahead of the first prefetch', async () => {
    await installPlugin()
    expect(preloadHints.warmRouteChunkHints).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['that saves data', { saveData: true }],
    ['as slow as 2g', { effectiveType: 'slow-2g' }],
  ])('does not fetch the hints ahead of a prefetch on a connection %s', async (_, connection) => {
    withConnection(connection)
    await installPlugin()
    expect(preloadHints.warmRouteChunkHints).not.toHaveBeenCalled()
  })
})
