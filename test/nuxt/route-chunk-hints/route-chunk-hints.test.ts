import { afterEach, describe, expect, it, vi } from 'vitest'

import layouts from '#build/layouts.mjs'

const documentHints = {
  files: [
    { rel: 'modulepreload', file: 'layout.js' },
    { rel: 'preload', as: 'style', file: 'layout.css' },
  ],
  layouts: { default: [0, 1] },
  pages: '/__nuxt_preload/test.json',
}

const pageHints = {
  files: [
    { rel: 'modulepreload', file: 'page.js' },
    { rel: 'preload', as: 'style', file: 'layout.css' },
  ],
  chunks: { 'page-key': [0, 1] },
}

const page = () => Object.assign(vi.fn(), { __nuxt_module: 'page-key' })

// hints are read once per document, so each test loads the module afresh
function load (pages: unknown = pageHints) {
  const fetch = vi.fn(() => Promise.resolve(pages ? new Response(JSON.stringify(pages)) : new Response(null, { status: 404 })))
  vi.stubGlobal('fetch', fetch)
  vi.resetModules()
  return import('#app/internal/preload-hints').then(module => ({ ...module, fetch }))
}

/** A document of a build with hints: the renderer writes them even when they list nothing. */
function withHints (value: unknown = documentHints, pages?: unknown) {
  const script = document.createElement('script')
  script.type = 'application/json'
  script.setAttribute('data-nuxt-preload', 'nuxt-app')
  script.textContent = JSON.stringify(value)
  document.head.appendChild(script)
  return load(pages)
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
    expect(hintLinks()).toEqual([
      { rel: 'modulepreload', as: undefined, href: '/_nuxt/layout.js', crossOrigin: '' },
      { rel: 'preload', as: 'style', href: '/_nuxt/layout.css', crossOrigin: '' },
    ])
    // the initial layout does not wait for route component hints
    expect(fetch).not.toHaveBeenCalled()
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
    // fetched once, at low priority, as nothing waits on it
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/__nuxt_preload/test.json', { priority: 'low' })
    // the stylesheet it shares with the layout is hinted once
    expect(hintLinks().filter(link => link.href === '/_nuxt/layout.css')).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()
  })

  it.each([
    ['loads with the entry', Object.assign(vi.fn(), { __nuxt_module: 'entry-key' })],
    ['the hints do not list', Object.assign(vi.fn(), { __nuxt_module: 'other-key' })],
    ['the build does not know', vi.fn()],
    ['is a server page', Object.assign(vi.fn(), { __nuxt_module: false })],
  ])('hints a destination around a route component that %s', async (_, other) => {
    const { preloadRouteChunks } = await withHints(documentHints, {
      ...pageHints,
      chunks: { ...pageHints.chunks, 'entry-key': [] },
    })
    const loader = page()

    void preloadRouteChunks([loader, other])
    await vi.waitFor(() => expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/page.js', '/_nuxt/layout.css']))
    expect(loader).not.toHaveBeenCalled()
    expect(other).not.toHaveBeenCalled()
  })

  it('fetches nothing for a destination whose hints cannot be fetched', async () => {
    const { preloadRouteChunks, fetch } = await withHints(documentHints, null)
    const loader = page()

    // the destination is not left to the caller, which would run the route components to load them
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
    expect(hintLinks().filter(link => link.rel !== 'prefetch')).toEqual([
      { rel: 'modulepreload', as: undefined, href: '/_nuxt/layout.js', crossOrigin: '' },
      { rel: 'preload', as: 'style', href: '/_nuxt/layout.css', crossOrigin: '' },
    ])
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
    // the client build inserts a stylesheet or a preload of its own for a chunk it loads
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
    expect(hintLinks().map(({ rel, href }) => ({ rel, href }))).toEqual([
      { rel: 'stylesheet', href: '/_nuxt/layout.css' },
      { rel: 'modulepreload', href: '/_nuxt/layout.js' },
    ])
  })

  // The hints name files, which are resolved against the URL the app serves its build assets
  // from. Hints injected into the document, ahead of the renderer's, cannot name another origin
  // that way, and must not reach another path.
  it('only hints chunks of the build', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...documentHints,
      files: [
        ...documentHints.files,
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
    const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[href]')].map(link => link.href)
    expect(links.slice(0, 2)).toEqual([assets + 'layout.js', assets + 'layout.css'])
    expect(links).toHaveLength(4)
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
    const { preloadLayoutChunks, preloadRouteChunks } = await withHints(
      { ...documentHints, files: [entry], layouts: { default: [0] } },
      { files: [entry], chunks: { 'page-key': [0] } },
    )

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect([...document.head.querySelectorAll('link')].filter(link => /x\.|layout\./.test(link.href))).toEqual([])
  })

  it('hints the files listed next to an entry that is not a hint', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...documentHints,
      files: [{ rel: 'stylesheet', file: 'other.css' }, ...documentHints.files],
      layouts: { default: [0, 1, 2] },
    })

    void preloadLayoutChunks('default')
    expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.js', '/_nuxt/layout.css'])
  })

  it.each([
    ['another origin', 'https://evil.example/__nuxt_preload/test.json'],
    ['another path', '/api/test.json'],
  ])('does not fetch route component hints from %s', async (_, pages) => {
    const { preloadRouteChunks, warmRouteChunkHints, fetch } = await withHints({ ...documentHints, pages })

    warmRouteChunkHints()
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(hintLinks()).toEqual([])
  })

  it('requests a chunk without CORS where the client build does', async () => {
    const { preloadLayoutChunks } = await withHints({
      ...documentHints,
      files: [documentHints.files[0], { ...documentHints.files[1], noCors: true }],
    })

    void preloadLayoutChunks('default')
    expect([...document.head.querySelectorAll('link[href*="/_nuxt/"]')].map(link => link.hasAttribute('crossorigin'))).toEqual([true, false])
  })

  it('carries the CSP nonce of the document', async () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'csp-nonce')
    meta.setAttribute('nonce', 'abc')
    document.head.appendChild(meta)
    const { preloadLayoutChunks } = await withHints()

    void preloadLayoutChunks('default')
    expect([...document.head.querySelectorAll('link[href*="/_nuxt/"]')].map(link => link.getAttribute('nonce'))).toEqual(['abc', 'abc'])
  })

  it.each([
    ['without `modulepreload`', 'modulepreload', documentHints],
    // Firefox is such a browser with `network.preload` off. A build that loads chunks as classic
    // scripts hints nothing else.
    ['in which `preload` is turned off', 'preload', { ...documentHints, files: [{ rel: 'preload', as: 'script', file: 'layout.js', noCors: true }, documentHints.files[1]] }],
  ])('fetches nothing in a browser %s', async (_, rel, hints) => {
    const supports = withoutRel(rel)
    try {
      const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints(hints)
      const loader = page()

      await expect(preloadLayoutChunks('default')).resolves.toBe(true)
      await expect(preloadRouteChunks([loader])).resolves.toBe(true)
      expect(fetch).not.toHaveBeenCalled()
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
        ...documentHints,
        files: [{ rel: 'preload', as: 'script', file: 'layout.js', noCors: true }, documentHints.files[1]],
      })

      void preloadLayoutChunks('default')
      expect(hintLinks().map(({ rel, as }) => ({ rel, as }))).toEqual([{ rel: 'preload', as: 'script' }, { rel: 'preload', as: 'style' }])
    } finally {
      supports.mockRestore()
    }
  })

  // markup injected ahead of the renderer's, or a host that answers any path, can put something
  // else in the place of hints, which must not fail the prefetch that reads it
  it.each([
    ['lack the table of layouts', { files: documentHints.files }],
    ['list something other than files', { ...documentHints, files: {} }],
    ['map a layout to something other than indices', { ...documentHints, layouts: { default: { 0: 0 } } }],
    ['are not an object', 'hints'],
  ])('fetches nothing when the hints of the document %s', async (_, value) => {
    const { preloadLayoutChunks } = await withHints(value)

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    expect(hintLinks()).toEqual([])
  })

  it.each([
    ['lack the table of chunks', { files: pageHints.files }],
    ['list something other than files', { ...pageHints, files: 'files' }],
    ['map a route component to something other than indices', { ...pageHints, chunks: { 'page-key': {} } }],
    ['are another response', { error: 'not found' }],
  ])('fetches nothing when the hints of route components %s', async (_, pages) => {
    const { preloadRouteChunks, fetch } = await withHints(documentHints, pages)

    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(hintLinks()).toEqual([])
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // A request that failed is not an answer. Kept as one, route components would go unfetched
  // until the page is reloaded. A dropped connection or a deployment under way does not justify
  // that.
  it('asks again for the hints of route components after a request for them failed, less and less often', async () => {
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

  // a connection that drops fails the hint of a chunk the deployment does have
  it('asks again for a chunk whose hint failed, less and less often', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { preloadLayoutChunks } = await withHints()
    const script = () => document.head.querySelector<HTMLLinkElement>('link[href$="/_nuxt/layout.js"]')
    const fail = async (prefetch: Promise<boolean>) => {
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
    const second = preloadLayoutChunks('default')
    expect(script()).not.toBeNull()
    await fail(second)

    vi.setSystemTime(Date.now() + 1000)
    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    expect(script()).toBeNull()
    vi.setSystemTime(Date.now() + 1000)
    void preloadLayoutChunks('default')
    expect(hintLinks().map(link => link.href)).toEqual(['/_nuxt/layout.css', '/_nuxt/layout.js'])
  })

  it('fetches nothing for a layout or route component a build with hints lists none for', async () => {
    const { preloadLayoutChunks, preloadRouteChunks, fetch } = await withHints({ files: [], layouts: {} })

    await expect(preloadLayoutChunks('default')).resolves.toBe(true)
    await expect(preloadRouteChunks([page()])).resolves.toBe(true)
    expect(fetch).not.toHaveBeenCalled()
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
