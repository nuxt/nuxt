import { afterEach, describe, expect, it, vi } from 'vitest'

import layouts from '#build/layouts.mjs'

const documentHints = { url: '/__nuxt_preload/test.json' }

const layoutFiles = [
  { rel: 'modulepreload', file: 'layout.js' },
  { rel: 'preload', as: 'style', file: 'layout.css' },
]

const buildHints = {
  files: [...layoutFiles, { rel: 'modulepreload', file: 'page.js' }],
  layouts: { default: [0, 1] },
  pages: { 'page-key': [2, 1] },
}

const page = () => Object.assign(vi.fn(), { __nuxt_module: 'page-key' })

// hints are read once per document, so each test loads the module afresh
function load (hints: unknown = buildHints) {
  const fetch = vi.fn(() => Promise.resolve(hints ? new Response(JSON.stringify(hints)) : new Response(null, { status: 404 })))
  vi.stubGlobal('fetch', fetch)
  vi.resetModules()
  return import('#app/internal/preload-hints').then(module => ({ ...module, fetch }))
}

function withHints (hints?: unknown, value: unknown = documentHints) {
  const script = document.createElement('script')
  script.type = 'application/json'
  script.setAttribute('data-nuxt-preload', 'nuxt-app')
  script.textContent = JSON.stringify(value)
  document.head.appendChild(script)
  return load(hints)
}

function withoutRel (rel: string) {
  const relList = Object.getPrototypeOf(document.createElement('link').relList) as DOMTokenList
  return vi.spyOn(relList, 'supports').mockImplementation(token => token !== rel)
}

function hintLinks () {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[href*="/_nuxt/"]')]
    .map(link => ({ rel: link.rel, as: link.as || undefined, href: new URL(link.href).pathname, crossOrigin: link.crossOrigin }))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const el of document.head.querySelectorAll('[data-nuxt-preload], link[href*="/_nuxt/"], link[href*="evil.example"], link[href*="/api/"], meta[property=csp-nonce]')) {
    el.remove()
  }
})

describe('experimental.routeChunkHints', () => {
  it('does not evaluate the layout of the initial route', () => {
    expect((layouts.default as { __asyncResolved?: unknown }).__asyncResolved).toBeFalsy()
  })

  it('fetches the chunks of a layout without evaluating them', async () => {
    const { preloadLayoutChunks, fetch } = await withHints()

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks()).toEqual([
      { rel: 'modulepreload', as: undefined, href: '/_nuxt/layout.js', crossOrigin: '' },
      { rel: 'preload', as: 'style', href: '/_nuxt/layout.css', crossOrigin: '' },
    ]))
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/__nuxt_preload/test.json', { priority: 'low' })
    expect((layouts.default as { __asyncResolved?: unknown }).__asyncResolved).toBeFalsy()
  })

  it('fetches the chunks of route components from the hints of the build', async () => {
    const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints()
    void preloadLayoutChunks('default')
    const loader = page()

    void preloadRouteChunks([loader, undefined])
    void preloadRouteChunks([loader])

    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toContain('/_nuxt/page.js'))
    expect(hintLinks().map(link => link.rel)).toEqual(['modulepreload', 'preload', 'modulepreload'])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(hintLinks().filter(link => link.href === '/_nuxt/layout.css')).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()
  })

  it.each([
    ['loads with the entry', Object.assign(vi.fn(), { __nuxt_module: 'entry-key' })],
    ['is not listed in the hints', Object.assign(vi.fn(), { __nuxt_module: 'other-key' })],
    ['is unknown to the build', vi.fn()],
    ['is a server page', Object.assign(vi.fn(), { __nuxt_module: false })],
  ])('hints the rest of a destination when one of its route components %s', async (_, other) => {
    const { preloadRouteChunks } = await withHints({
      ...buildHints,
      pages: { ...buildHints.pages, 'entry-key': [] },
    })
    const loader = page()

    void preloadRouteChunks([loader, other])
    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/page.js', '/_nuxt/layout.css']))
    expect(loader).not.toHaveBeenCalled()
    expect(other).not.toHaveBeenCalled()
  })

  it('fetches nothing for a destination whose hints cannot be fetched', async () => {
    const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints(null)
    const loader = page()

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([loader])).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(hintLinks()).toEqual([])
    expect(loader).not.toHaveBeenCalled()
  })

  it('does not fetch the hints for a destination without a marked route component', async () => {
    const { preloadRouteChunks, fetch } = await withHints()

    await expect(preloadRouteChunks([() => {}, undefined])).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('hints a chunk the document only prefetches', async () => {
    // the renderer prefetches every layout, which Safari ignores
    const prefetch = document.createElement('link')
    prefetch.rel = 'prefetch'
    prefetch.as = 'style'
    prefetch.href = '/_nuxt/layout.css'
    document.head.appendChild(prefetch)
    const { preloadLayoutChunks } = await withHints()

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks().filter(link => link.rel !== 'prefetch')).toEqual([
      { rel: 'modulepreload', as: undefined, href: '/_nuxt/layout.js', crossOrigin: '' },
      { rel: 'preload', as: 'style', href: '/_nuxt/layout.css', crossOrigin: '' },
    ]))
  })

  it('does not look through the document again for chunks it has hinted', async () => {
    const { preloadLayoutChunks, preloadRouteChunks } = await withHints()
    void preloadLayoutChunks('default')
    void preloadRouteChunks([page()])
    await vi.waitFor(() => expect(hintLinks()).toHaveLength(3))

    const querySelectorAll = vi.spyOn(document, 'querySelectorAll')
    const createElement = vi.spyOn(document, 'createElement')
    try {
      await expect(preloadLayoutChunks('default')).resolves.toBe(true)
      await expect(preloadRouteChunks([page()])).resolves.toBe(true)
      expect(querySelectorAll).not.toHaveBeenCalled()
      expect(createElement).not.toHaveBeenCalled()
    } finally {
      querySelectorAll.mockRestore()
      createElement.mockRestore()
    }
    expect(hintLinks()).toHaveLength(3)
  })

  it('still finds a chunk another link has loaded since it last looked', async () => {
    const { preloadLayoutChunks, preloadRouteChunks } = await withHints()
    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks()).toHaveLength(2))
    const loaded = document.createElement('link')
    loaded.rel = 'modulepreload'
    loaded.href = '/_nuxt/page.js'
    document.head.appendChild(loaded)

    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(hintLinks().filter(link => link.href === '/_nuxt/page.js')).toHaveLength(1)
  })

  it('does not hint a chunk the document already loads', async () => {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = '/_nuxt/layout.css'
    document.head.appendChild(stylesheet)
    const { preloadLayoutChunks } = await withHints()

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks().map(({ rel, href }) => ({ rel, href }))).toEqual([
      { rel: 'stylesheet', href: '/_nuxt/layout.css' },
      { rel: 'modulepreload', href: '/_nuxt/layout.js' },
    ]))
  })

  it('only hints chunks of the build', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...buildHints,
      files: [
        ...layoutFiles,
        { rel: 'modulepreload', file: 'https://evil.example/x.js' },
        { rel: 'modulepreload', file: '//evil.example/x.js' },
        { rel: 'preload', as: 'style', file: '../api/x.css' },
        { rel: 'preload', as: 'style', file: '' },
        { rel: 'preload', as: 'style', file: { toString: () => 'x.css' } },
        { rel: 'preload', as: 'style' },
      ],
      layouts: { default: [0, 1, 2, 3, 4, 5, 6, 7] },
    })

    void preloadLayoutChunks('default')
    const assets = new URL('/_nuxt/', location.href).href
    const hinted = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[href]')].map(link => link.href)
    await vi.waitFor(() => expect(hinted()).toHaveLength(4))
    const links = hinted()
    expect(links.slice(0, 2)).toEqual([assets + 'layout.js', assets + 'layout.css'])
    expect(links.every(href => href.startsWith(assets))).toBe(true)
  })

  it.each([
    ['a stylesheet to apply', { rel: 'stylesheet', file: 'layout.css' }],
    ['a prefetch', { rel: 'prefetch', as: 'script', file: 'x.js' }],
    ['no `rel`', { file: 'x.js' }],
    ['a `rel` that is not a string', { rel: ['modulepreload'], file: 'x.js' }],
    ['a preload of nothing in particular', { rel: 'preload', file: 'x.js' }],
    ['a preload of something a build does not load', { rel: 'preload', as: 'font', file: 'x.woff2' }],
    ['a module preloaded as something else', { rel: 'modulepreload', as: 'style', file: 'x.js' }],
    ['nothing', null],
  ])('makes no link from an entry of the hints that is %s', async (_, entry) => {
    const { preloadLayoutChunks, preloadRouteChunks } = await withHints({ files: [entry], layouts: { default: [0] }, pages: { 'page-key': [0] } })

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect([...document.head.querySelectorAll('link')].filter(link => /x\.|layout\./.test(link.href))).toEqual([])
  })

  it('hints the files listed next to an entry that is not a hint', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...buildHints,
      files: [{ rel: 'stylesheet', file: 'other.css' }, ...layoutFiles],
      layouts: { default: [0, 1, 2] },
    })

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.js', '/_nuxt/layout.css']))
  })

  it.each([
    ['another origin', 'https://evil.example/__nuxt_preload/test.json'],
    ['another path', '/api/test.json'],
  ])('does not fetch the hints from %s', async (_, url) => {
    const { preloadLayoutChunks, preloadRouteChunks, warmRouteChunkHints, fetch } = await withHints(buildHints, { url })

    warmRouteChunkHints()
    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(hintLinks()).toEqual([])
  })

  it('requests a chunk without CORS where the client build does', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...buildHints,
      files: [layoutFiles[0], { ...layoutFiles[1], noCors: true }],
    })

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect([...document.head.querySelectorAll('link[href*="/_nuxt/"]')].map(link => link.hasAttribute('crossorigin'))).toEqual([true, false]))
  })

  it('carries the CSP nonce of the document', async () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'csp-nonce')
    meta.setAttribute('nonce', 'abc')
    document.head.appendChild(meta)
    const { preloadLayoutChunks } = await withHints()

    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect([...document.head.querySelectorAll('link[href*="/_nuxt/"]')].map(link => link.getAttribute('nonce'))).toEqual(['abc', 'abc']))
  })

  it.each([
    ['without `modulepreload`', 'modulepreload', buildHints],
    // Firefox is such a browser with `network.preload` off. A build that loads chunks as classic
    // scripts hints nothing else.
    ['in which `preload` is turned off', 'preload', { ...buildHints, files: [{ rel: 'preload', as: 'script', file: 'layout.js', noCors: true }, layoutFiles[1], { rel: 'preload', as: 'script', file: 'page.js', noCors: true }] }],
  ])('fetches nothing in a browser %s', async (_, rel, hints) => {
    const supports = withoutRel(rel)
    try {
      const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints(hints)
      const loader = page()

      await expect(preloadLayoutChunks('default')).resolves.toBe(true)
      await expect(preloadRouteChunks([loader])).resolves.toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(hintLinks()).toEqual([])
      expect(loader).not.toHaveBeenCalled()
    } finally {
      supports.mockRestore()
    }
  })

  it('hints classic scripts in a browser without `modulepreload`', async () => {
    const supports = withoutRel('modulepreload')
    try {
      const { preloadLayoutChunks } = await withHints({
        ...buildHints,
        files: [{ rel: 'preload', as: 'script', file: 'layout.js', noCors: true }, layoutFiles[1]],
      })

      void preloadLayoutChunks('default')
      await vi.waitFor(() => expect(hintLinks().map(({ rel, as }) => ({ rel, as }))).toEqual([{ rel: 'preload', as: 'script' }, { rel: 'preload', as: 'style' }]))
    } finally {
      supports.mockRestore()
    }
  })

  it.each([
    ['is not an object', 'hints'],
    ['names no hints', {}],
    ['names something other than a URL', { url: { href: '/__nuxt_preload/test.json' } }],
  ])('fetches nothing when the pointer to the hints %s', async (_, value) => {
    const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints(buildHints, value)

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(hintLinks()).toEqual([])
  })

  it.each([
    ['lack the table of layouts', { files: buildHints.files, pages: buildHints.pages }],
    ['lack the table of route components', { files: buildHints.files, layouts: buildHints.layouts }],
    ['list something other than files', { ...buildHints, files: 'files' }],
    ['map to something other than indices', { ...buildHints, layouts: { default: { 0: 0 } }, pages: { 'page-key': {} } }],
    ['are another response', { error: 'not found' }],
  ])('fetches nothing when the hints %s', async (_, hints) => {
    const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints(hints)

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(hintLinks()).toEqual([])
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('asks again for the hints after a request for them failed, less and less often', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { preloadRouteChunks, fetch } = await withHints()
    fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('<!DOCTYPE html>'))
    const prefetch = () => preloadRouteChunks([page()])

    await expect(prefetch()).resolves.toBe(true)
    await expect(prefetch()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 1000)
    await expect(prefetch()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)

    vi.setSystemTime(Date.now() + 1000)
    await expect(prefetch()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.setSystemTime(Date.now() + 1000)
    await expect(prefetch()).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(hintLinks()).toEqual([])

    vi.setSystemTime(Date.now() + 4000)
    void prefetch()
    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/page.js', '/_nuxt/layout.css']))
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('asks again for a module whose hint failed, less and less often', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { preloadLayoutChunks } = await withHints()
    const script = () => document.head.querySelector<HTMLLinkElement>('link[href$="/_nuxt/layout.js"]')
    const fail = async (prefetch: Promise<boolean>) => {
      await vi.waitFor(() => expect(script()).not.toBeNull())
      for (const link of document.head.querySelectorAll('link[href*="/_nuxt/layout."]')) {
        link.dispatchEvent(new Event(link === script() ? 'error' : 'load'))
      }
      await expect(prefetch).resolves.toBe(true)
    }

    await fail(preloadLayoutChunks('default'))
    expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.css'])

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    expect(script()).toBeNull()

    vi.setSystemTime(Date.now() + 1000)
    await fail(preloadLayoutChunks('default'))

    vi.setSystemTime(Date.now() + 1000)
    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    expect(script()).toBeNull()
    vi.setSystemTime(Date.now() + 1000)
    void preloadLayoutChunks('default')
    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.css', '/_nuxt/layout.js']))
  })

  it('reports a `rel="preload"` hint that failed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { preloadLayoutChunks, onFailedPreload } = await withHints()
    const listener = vi.fn()
    onFailedPreload(listener)
    const settle = async (prefetch: Promise<boolean>, failing: string) => {
      await vi.waitFor(() => expect(document.head.querySelector('link[href$="/_nuxt/layout.js"]')).not.toBeNull())
      for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[href*="/_nuxt/layout."]')) {
        link.dispatchEvent(new Event(link.href.endsWith(failing) ? 'error' : 'load'))
      }
      await expect(prefetch).resolves.toBe(true)
    }

    await settle(preloadLayoutChunks('default'), 'layout.js')
    expect(listener).not.toHaveBeenCalled()

    vi.setSystemTime(Date.now() + 1000)
    await settle(preloadLayoutChunks('default'), 'layout.css')
    expect(listener).toHaveBeenCalledTimes(1)
    const late = vi.fn()
    onFailedPreload(late)
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('does not ask again for a file whose `rel="preload"` hint failed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { preloadLayoutChunks } = await withHints()

    const prefetch = preloadLayoutChunks('default')
    await vi.waitFor(() => expect(document.head.querySelector('link[href$="/_nuxt/layout.css"]')).not.toBeNull())
    for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[href*="/_nuxt/layout."]')) {
      link.dispatchEvent(new Event(link.href.endsWith('layout.css') ? 'error' : 'load'))
    }
    await expect(prefetch).resolves.toBe(true)

    vi.setSystemTime(Date.now() + 60_000)
    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.js', '/_nuxt/layout.css'])
  })

  it('fetches nothing for a layout or route component the hints do not list', async () => {
    const { preloadLayoutChunks, preloadRouteChunks } = await withHints({ files: [], layouts: {}, pages: {} })

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(hintLinks()).toEqual([])
  })

  it('leaves loading to the caller in a build without hints', async () => {
    const { preloadLayoutChunks, preloadRouteChunks, warmRouteChunkHints, fetch } = await load()

    warmRouteChunkHints()
    await expect(preloadLayoutChunks('default')).resolves.toBe(false)
    await expect(preloadRouteChunks([page()])).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(hintLinks()).toEqual([])
  })
})
