import type { Page } from '@playwright/test'
import { expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('ssr-streaming'),
  },
})

const BOOTSTRAP = 'window.__unhead__={_q:[],push(e){this._q.push(e)}}'

/** Fetch HTML without retrying error responses. */
function fetchRaw (baseURL: string | undefined, path: string, init: RequestInit = {}) {
  return globalThis.fetch(new URL(path, baseURL), { ...init, headers: { accept: 'text/html', ...init.headers } })
}

function collectErrors (page: Page) {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') { errors.push(msg.text()) }
  })
  return errors
}

test.describe('SSR Streaming', () => {
  test('streams a shell with the bootstrap script and IIFE', async ({ fetch, isDev }) => {
    const res = await fetch('/')
    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain(BOOTSTRAP)
    if (isDev) {
      expect(html).toContain('var __unhead_iife__')
    } else {
      expect(html).toMatch(/<body[^>]*><script async src="[^"]*\.js"><\/script>/)
    }
  })

  test('sends prefetch hints in the shell rather than the link header', async ({ fetch, isDev }) => {
    test.skip(isDev, 'dev sends no resource hints in the link header')
    const res = await fetch('/')
    const html = await res.text()

    expect(res.headers.get('link')).toContain('rel="modulepreload"')
    expect(res.headers.get('link')).not.toContain('rel="prefetch"')
    expect(html).toMatch(/<link rel="prefetch"[^>]* data-href="[^"]+\.js"/)
  })

  test('synchronous head tags land in the shell <head>', async ({ fetch }) => {
    const html = await fetch('/').then(r => r.text())

    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain('<title>Streaming Home</title>')
    expect(head).toContain('rel="canonical"')
    expect(head).toContain('application/ld+json')
    // entries registered after an await are still streamed as pushes
    expect(html).toContain('window.__unhead__.push(')
  })

  test('async page streams head updates via suspense chunks', async ({ fetch }) => {
    const html = await fetch('/async-head').then(r => r.text())

    expect(html).toContain('Async Head Title')
    expect(html).toContain('Async description from suspense')
    expect(html).toContain('window.__unhead__.push(')
  })

  // late JSON-LD/noscript/bodyClose tags come back as real markup, only
  // head-only tags (title, meta) ship as patches
  test('late JSON-LD, noscript and bodyClose tags render as markup before </body>', async ({ fetch }) => {
    const html = await fetch('/late-tags').then(r => r.text())

    const contentIdx = html.indexOf('late-loaded')
    expect(contentIdx, 'page content must render').toBeGreaterThan(-1)

    const jsonLd = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>/)
    expect(jsonLd, 'JSON-LD must render as markup').toBeTruthy()
    expect(jsonLd!.index!, 'JSON-LD markup must follow the app content').toBeGreaterThan(contentIdx)
    expect(html).toContain('"@type":"Product"')

    expect(html, 'noscript must render as markup').toMatch(/<noscript[^>]*>late noscript fallback<\/noscript>/)
    expect(html.indexOf('late noscript fallback')).toBeLessThan(html.lastIndexOf('</body>'))

    expect(html, 'entry-level bodyClose script must render as markup').toMatch(/<script[^>]*id="late-body-close"[^>]*>/)

    expect(html).toContain('window.__unhead__.push(')
    expect(html).not.toContain('<meta property="og:title"')
    expect(html).not.toContain('<meta name="description"')
  })

  test('late tags hydrate: markup adopted, no duplicates, head patched', async ({ page, goto }) => {
    const errors = collectErrors(page)
    await goto('/late-tags')

    await expect(page.locator('[data-testid="content"]').first()).toHaveText('late-loaded')
    await expect(page).toHaveTitle('Late Tags Title')
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', 'Late description from suspense')
    await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', 'Late Tags og')

    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1)
    await expect(page.locator('noscript')).toHaveCount(1)
    await expect(page.locator('script#late-body-close')).toHaveCount(1)

    expect(errors).toEqual([])
  })

  test('late JSON-LD identical to the shell block is not served twice', async ({ fetch }) => {
    const html = await fetch('/jsonld-dedupe').then(r => r.text())

    expect(html.match(/"name":"Acme"/g), 'the shell Acme block must appear exactly once').toHaveLength(1)
    expect(html, 'the distinct late block must render as markup').toContain('"@type":"Product","name":"Dedupe Product"')
    // nothing head-only here, so no patch at all
    expect(html).not.toContain('window.__unhead__.push(')
  })

  // once the stream dies a held tag cannot ship as a patch, so the error close must write it
  test('held JSON-LD survives a mid-stream render error', async ({ fetch }) => {
    const res = await fetch('/error-late-tags')
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(html).toContain('error late tags shell content')
    expect(html).toContain('Late tags render failure')

    const jsonLdIdx = html.indexOf('"name":"Held Error Product"')
    expect(jsonLdIdx, 'held JSON-LD must be written with the error closing').toBeGreaterThan(-1)
    expect(jsonLdIdx).toBeGreaterThan(html.indexOf('id="__nuxt"'))
    expect(jsonLdIdx, 'held JSON-LD must not be in the shell head').toBeGreaterThan(html.indexOf('</head>'))

    expect(html, 'the head patch must carry the late meta').toMatch(/window\.__unhead__\.push\(.*Held error description/)
    expect(html.trimEnd()).toMatch(/<\/body><\/html>$/)
  })

  test('client hydration works with streamed head', async ({ page, goto }) => {
    const errors = collectErrors(page)
    await goto('/')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Streaming Home')
    await expect(page).toHaveTitle('Streaming Home')

    await page.locator('[data-testid="link-async"]').first().click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/async-head')

    await expect(page.locator('[data-testid="content"]').first()).toHaveText('async-loaded')
    await expect(page).toHaveTitle('Async Head Title')

    expect(errors).toEqual([])
  })

  test('direct navigation to async page streams correctly', async ({ page, goto }) => {
    await goto('/async-head')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Async Head Page')
    await expect(page.locator('[data-testid="content"]').first()).toHaveText('async-loaded')
    await expect(page).toHaveTitle('Async Head Title')
  })

  test('multi-suspense boundaries flush head updates in document order', async ({ fetch, page, goto }) => {
    const html = await fetch('/multi-async').then(r => r.text())

    const pushes = html.match(/window\.__unhead__\.push\(/g) || []
    expect(pushes.length, `expected >= 2 streamed head pushes, got ${pushes.length}`).toBeGreaterThanOrEqual(2)

    const idxA = html.indexOf('a-meta')
    const idxB = html.indexOf('b-meta')
    expect(idxA, 'child A meta should be streamed').toBeGreaterThan(-1)
    expect(idxB, 'child B meta should be streamed').toBeGreaterThan(-1)
    // child A resolves first (50ms vs 200ms)
    expect(idxA, 'child A push must appear before child B push in document order').toBeLessThan(idxB)

    await goto('/multi-async')
    await expect(page.locator('[data-testid="child-a"]').first()).toHaveText('child-a-loaded')
    await expect(page.locator('[data-testid="child-b"]').first()).toHaveText('child-b-loaded')
    await expect(page.locator('head meta[name="child-a"]')).toHaveAttribute('content', 'a-meta')
    await expect(page.locator('head meta[name="child-b"]')).toHaveAttribute('content', 'b-meta')
  })

  test('per-route streaming opt-out via routeRules', async ({ fetch }) => {
    const html = await fetch('/buffered').then(r => r.text())

    expect(html).toMatch(/<head>[\s\S]*<title>Buffered Title<\/title>[\s\S]*<\/head>/)
    expect(html).not.toContain('window.__unhead__={_q:[]')
    expect(html).not.toContain('window.__unhead__.push(')
  })

  // `server/plugins/streaming-decision.ts` sets `shouldStream = false` when the `no-stream` query is present
  test('render:route hook can disable streaming at runtime', async ({ fetch }) => {
    const html = await fetch('/?no-stream').then(r => r.text())

    expect(html).not.toContain('window.__unhead__={_q:[]')
    expect(html).not.toContain('window.__unhead__.push(')
  })

  test('navigateTo() from a page is honored as a redirect', async ({ baseURL }) => {
    const res = await fetchRaw(baseURL, '/redirect', { redirect: 'manual' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('/')

    const body = await res.text()
    expect(body).not.toContain('window.__unhead__={_q:[]')
    expect(body).not.toMatch(/<body[^>]*>this content must never reach the client/)
  })

  test('bot user-agent falls back to buffered response', async ({ baseURL }) => {
    const html = await fetchRaw(baseURL, '/', { headers: { 'user-agent': 'Googlebot/2.1' } }).then(r => r.text())

    expect(html).not.toContain('var __unhead_iife__')
    expect(html).not.toMatch(/<body[^>]*><script async src="[^"]*\.js"><\/script>/)
    expect(html).toContain('<title>Streaming Home</title>')
  })

  // a synchronous setup error surfaces before the shell is committed
  test('error before shell flush falls back to the buffered error renderer', async ({ baseURL }) => {
    const res = await fetchRaw(baseURL, '/error-before')
    const html = await res.text()

    expect(res.status).toBe(500)
    expect(html).not.toContain('window.__unhead__={_q:[]')
    expect(html).not.toContain('window.__unhead__.push(')
  })

  // the status is already committed when the async component fails, so the error travels in the payload
  test('error during streaming commits 200 and injects the error into the payload', async ({ fetch }) => {
    const res = await fetch('/error-during')
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(html).toContain(BOOTSTRAP)
    expect(html).toContain('shell content before the error')
    expect(html).toContain('Mid-stream render failure')
    expect(html.trimEnd()).toMatch(/<\/body><\/html>$/)
  })

  test('client renders the error page after a mid-stream error', async ({ page, goto }) => {
    await goto('/error-during')

    await expect(page.locator('body')).toContainText('Mid-stream render failure')
    await expect(page.locator('[data-testid="shell-text"]')).toHaveCount(0)
  })

  // `/late-status` sets `418` after an await, once a streamed shell has committed the status
  test('a post-await setResponseStatus is dropped when streaming, applied when buffered', async ({ baseURL }) => {
    expect((await fetchRaw(baseURL, '/late-status')).status).toBe(200)
    expect((await fetchRaw(baseURL, '/late-status', { headers: { 'user-agent': 'Googlebot/2.1' } })).status).toBe(418)
  })

  // the `/nonce` fixture plugin stamps `test-csp-nonce` on the head scripts
  test('a head-script nonce is threaded onto streamed inline scripts', async ({ fetch, isDev }) => {
    const html = await fetch('/nonce').then(r => r.text())

    expect(html).toMatch(/<script nonce="test-csp-nonce">window\.__unhead__\|\|\(window\.__unhead__=\{_q:\[\]/)
    expect(html).toMatch(/<script nonce="test-csp-nonce">window\.__unhead__\.push/)

    if (!isDev) {
      expect(html).toMatch(/<script async nonce="test-csp-nonce" src=/)
      expect(html).toMatch(/<style nonce="test-csp-nonce">[^<]*\.nonce-probe/)
    }
  })

  test('route-level CSS is streamed after the shell', async ({ fetch, isDev }) => {
    test.skip(isDev, 'dev serves SFC <style> as JS modules, not extracted CSS assets')

    const html = await fetch('/styled').then(r => r.text())

    expect(html.slice(html.indexOf('</head>'))).toMatch(/<style[^>]*>[^<]*\.css-flash-marker/)
  })

  // A nested async component is only instantiated once its async parent resolves, after the
  // first chunk has streamed, so its SFC `<style>` lands in the closing HTML behind its own DOM.
  // This is documented as a known limitation under SSR streaming in the experimental features guide.
  test('async-component CSS streams behind its DOM (FOUC footgun)', async ({ fetch, isDev }) => {
    test.skip(isDev, 'dev serves SFC <style> as JS modules, not extracted CSS assets')

    const html = await fetch('/fouc').then(r => r.text())

    const domIdx = html.indexOf('data-testid="fouc-target"')
    expect(domIdx, 'styled async component must render').toBeGreaterThan(-1)
    const styleIdx = html.search(/<style[^>]*>[^<]*\.fouc-marker/)
    expect(styleIdx, 'the .fouc-marker <style> must be streamed').toBeGreaterThan(-1)
    expect(styleIdx, 'async-component CSS is streamed behind its DOM').toBeGreaterThan(domIdx)
  })

  test('async-component CSS visibly flashes unstyled mid-stream', async ({ page, baseURL, isDev }) => {
    test.skip(isDev, 'dev serves SFC <style> as JS modules, not extracted CSS assets')

    await page.goto(new URL('/fouc', baseURL).href, { waitUntil: 'commit' })

    const target = page.locator('[data-testid="fouc-target"]')
    let sawUnstyled = false
    let sawStyled = false
    for (let i = 0; i < 150 && !sawStyled; i++) {
      const bg = await target.evaluate(el => getComputedStyle(el).backgroundColor).catch(() => null)
      if (bg != null) {
        if (bg === 'rgb(0, 220, 130)') { sawStyled = true } else { sawUnstyled = true }
      }
      await page.waitForTimeout(20)
    }

    expect(sawUnstyled, 'the async component must paint before its streamed <style> arrives').toBe(true)
    expect(sawStyled, 'the streamed <style> must eventually apply').toBe(true)
  })

  test('Teleport-to-body content is appended after the app root', async ({ fetch }) => {
    const html = await fetch('/teleport').then(r => r.text())

    expect(html.slice(html.indexOf('</div>', html.indexOf('id="__nuxt"')))).toContain('teleported to body')
  })

  test('Teleport-to-body hydrates into <body> without errors', async ({ page, goto }) => {
    const pageErrors: string[] = []
    page.on('pageerror', err => pageErrors.push(err.message))

    await goto('/teleport')

    const teleported = page.locator('[data-testid="teleported"]')
    await expect(teleported).toHaveText('teleported to body')
    expect(await teleported.evaluate(el => el.parentElement?.tagName)).toBe('BODY')
    expect(pageErrors).toEqual([])
  })

  // the `/hooks` fixture plugin uses `render:html` (with `streaming: true`), `render:html:chunk`, `render:html:close` and `render:response`
  test('render:html streaming hooks mutate the shell and document', async ({ fetch }) => {
    const res = await fetch('/hooks')
    const html = await res.text()

    expect(html).toContain('<meta name="x-render-html" content="streaming">')
    expect(html).toContain('<!--render:html bodyPrepend-->')
    expect(html).toContain('<!--chunk:0-->')
    expect(html).toMatch(/<!--render:html:close bodyAppend-->[\s\S]*<\/body>/)
    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(res.headers.get('x-render-response')).toBe('stream;text/html;charset=utf-8')
  })

  // island teleports cannot be stitched into streamed body markup, so they are emitted as
  // `<template>`s at the end of the document and relocated by an inline script before hydration
  test('island page streams, with slot content as a relocation template', async ({ fetch }) => {
    const res = await fetch('/islands')
    const html = await res.text()

    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(html).toContain(BOOTSTRAP)
    expect(html).toMatch(/data-island-uid="[^"]*"> Island says: hello from server/)

    expect(html).toMatch(/<template data-island-uid="[^"]*" data-island-slot="default">/)
    expect(html).toContain('slotted from page')
    expect(html).toContain('template[data-island-uid]')
    expect(html).toContain('island before slot')
    expect(html).toContain('island after slot')
  })

  test('island page hydrates with slot content in place and no errors', async ({ page, goto }) => {
    const errors = collectErrors(page)
    await goto('/islands')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Streaming Islands Home')
    await expect(page.locator('[data-testid="island"]').first()).toContainText('hello from server')
    await expect(page).toHaveTitle('Streaming Islands')

    const slotIsland = page.locator('[data-testid="slot-island"]').first()
    await expect(slotIsland).toContainText('island before slot')
    await expect(slotIsland.locator('[data-testid="slot-content"]')).toHaveText('slotted from page')
    await expect(page.locator('template[data-island-uid]')).toHaveCount(0)

    expect(errors).toEqual([])
  })

  // a `nuxt-client` component inside a server component is teleported via the `uid;client` marker
  test('selective-client island hydrates and stays interactive', async ({ fetch, page, goto, builder }) => {
    test.skip(builder !== 'vite', 'selective-client islands ship a per-component client chunk only on the vite builder')
    const html = await fetch('/islands').then(r => r.text())

    expect(html).toMatch(/<template data-island-uid="[^"]*" data-island-component="[^"]*">/)
    expect(html).toContain('server-rendered island shell')
    expect(html).toContain('count: 0')

    await goto('/islands')

    const counter = page.locator('[data-testid="island-counter"]').first()
    await expect(counter).toHaveText('count: 0')
    await counter.click()
    await expect(counter).toHaveText('count: 1')
  })
})
