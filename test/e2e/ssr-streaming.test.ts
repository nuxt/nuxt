import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { fetch } from 'ofetch'
import { join } from 'pathe'
import { joinURL } from 'ufo'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'

const fixtureDir = fileURLToPath(new URL('../fixtures/ssr-streaming', import.meta.url))

test.describe.configure({ mode: isDev ? 'serial' : 'parallel' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('SSR Streaming', () => {
  test('streams response with transfer-encoding chunked', async ({ fetch }) => {
    const res = await fetch('/')
    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  test('shell contains bootstrap script and IIFE', async ({ fetch }) => {
    const res = await fetch('/')
    const html = await res.text()

    // Bootstrap queue script
    expect(html).toContain('window.__unhead__={_q:[],push(e){this._q.push(e)}}')
    // IIFE DOM renderer
    if (isDev) {
      // In dev, IIFE is inlined directly
      expect(html).toContain('var __unhead_iife__')
    } else {
      // In production, IIFE is loaded as a separate minified chunk
      expect(html).toMatch(/<body[^>]*><script async src="[^"]*\.js"><\/script>/)
    }
  })

  test('head tags are delivered via streaming push', async ({ fetch }) => {
    const res = await fetch('/')
    const html = await res.text()

    // useHead runs during component render, so title is delivered via streaming push (not in shell <head>)
    expect(html).toContain('window.__unhead__.push(')
    expect(html).toContain('Streaming Home')
  })

  test('async page streams head updates via suspense chunks', async ({ fetch }) => {
    const res = await fetch('/async-head')
    const html = await res.text()

    // The async page's head should be present in the final HTML via streaming push
    expect(html).toContain('Async Head Title')
    expect(html).toContain('Async description from suspense')
    expect(html).toContain('window.__unhead__.push(')
  })

  test('client hydration works with streamed head', async ({ page, goto }) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', err => pageErrors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') { consoleErrors.push(msg.text()) }
    })

    await goto('/')

    // Verify page rendered
    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Streaming Home')

    // Verify head was applied
    await expect(page).toHaveTitle('Streaming Home')

    // Navigate to async page
    await page.locator('[data-testid="link-async"]').first().click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/async-head')

    // Verify async content loaded
    await expect(page.locator('[data-testid="content"]').first()).toHaveText('async-loaded')

    // Verify head updated on client navigation
    await expect(page).toHaveTitle('Async Head Title')

    // Streamed-head pipeline must not introduce hydration mismatches or runtime errors
    expect(pageErrors, `pageerror events: ${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `console.error output: ${consoleErrors.join(' | ')}`).toEqual([])
  })

  test('direct navigation to async page streams correctly', async ({ page, goto }) => {
    await goto('/async-head')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Async Head Page')
    await expect(page.locator('[data-testid="content"]').first()).toHaveText('async-loaded')
    await expect(page).toHaveTitle('Async Head Title')
  })

  test('multi-suspense boundaries flush head updates in document order', async ({ fetch, page, goto }) => {
    const res = await fetch('/multi-async')
    const html = await res.text()

    // Each Suspense boundary should contribute its own streamed push block
    const pushMatches = html.match(/window\.__unhead__\.push\(/g) || []
    expect(pushMatches.length, `expected >= 2 streamed head pushes, got ${pushMatches.length}`).toBeGreaterThanOrEqual(2)

    // Both children's meta payloads must be present in the streamed HTML
    const idxA = html.indexOf('a-meta')
    const idxB = html.indexOf('b-meta')
    expect(idxA, 'child A meta should be streamed').toBeGreaterThan(-1)
    expect(idxB, 'child B meta should be streamed').toBeGreaterThan(-1)

    // Child A resolves first (50ms vs 200ms) so its push must precede child B's
    expect(idxA, 'child A push must appear before child B push in document order').toBeLessThan(idxB)

    // Hydrated document.head should reflect both meta tags
    await goto('/multi-async')
    await expect(page.locator('[data-testid="child-a"]').first()).toHaveText('child-a-loaded')
    await expect(page.locator('[data-testid="child-b"]').first()).toHaveText('child-b-loaded')
    await expect(page.locator('head meta[name="child-a"]')).toHaveAttribute('content', 'a-meta')
    await expect(page.locator('head meta[name="child-b"]')).toHaveAttribute('content', 'b-meta')
  })

  // Streaming is on by default; `routeRules: { buffered: true }` opts a route out.
  test('per-route streaming opt-out via routeRules', async ({ fetch }) => {
    const bufferedRes = await fetch('/buffered')
    const bufferedHtml = await bufferedRes.text()

    // Title rendered directly into <head>, not pushed via the streaming queue
    expect(bufferedHtml).toMatch(/<head>[\s\S]*<title>Buffered Title<\/title>[\s\S]*<\/head>/)
    expect(bufferedHtml).not.toContain('window.__unhead__={_q:[]')
    expect(bufferedHtml).not.toContain('window.__unhead__.push(')

    // Sibling route still streams — confirms the opt-out is per-route
    const streamedRes = await fetch('/')
    const streamedHtml = await streamedRes.text()
    expect(streamedHtml).toContain('window.__unhead__={_q:[],push(e){this._q.push(e)}}')
  })

  // The `render:route` hook fires once per request before rendering and lets
  // modules force buffered rendering at runtime (e.g. for authenticated users).
  // The fixture registers a nitro plugin that sets `shouldStream = false` when
  // the `no-stream` query param is present — see
  // `server/plugins/streaming-decision.ts`.
  test('render:route hook can disable streaming at runtime', async ({ fetch }) => {
    // Baseline: the route streams (bootstrap queue present)
    const streamedRes = await fetch('/')
    const streamedHtml = await streamedRes.text()
    expect(streamedHtml).toContain('window.__unhead__={_q:[],push(e){this._q.push(e)}}')

    // Same route, but the hook opts this request out of streaming
    const bufferedRes = await fetch('/?no-stream')
    const bufferedHtml = await bufferedRes.text()
    expect(bufferedHtml).not.toContain('window.__unhead__={_q:[]')
    expect(bufferedHtml).not.toContain('window.__unhead__.push(')
  })

  // Server-side `navigateTo()` throws `skipping render` inside `createSSRApp`,
  // which previously escaped the streaming path uncaught — the request would
  // emit a streamed 200 of half-rendered content instead of issuing the redirect.
  // The fix wraps `createSSRApp` and falls through to the buffered response path.
  test('navigateTo() from a page is honored as a redirect', async ({ _nuxtHooks }) => {
    const res = await fetch(joinURL(_nuxtHooks.ctx.url!, '/redirect'), {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('/')
    // Body must not contain the streamed shell — no <html>, no bootstrap queue
    const body = await res.text()
    expect(body).not.toContain('window.__unhead__={_q:[]')
    expect(body).not.toMatch(/<body[^>]*>this content must never reach the client/)
  })

  // Known limitation: in dev, Vite serves SFC `<style>` blocks as JavaScript
  // modules that inject styles client-side after evaluation. The streamed
  // shell paints DOM before those modules execute, causing a brief FOUC.
  // Production builds extract styles to real CSS files (or inlines them via
  // `features.inlineStyles`) and the shell ships them in `<head>`. This is
  // a Vite-dev pipeline limitation, not a streaming bug. Documented under
  // SSR streaming in `docs/3.guide/6.going-further/1.experimental-features.md`.
  test.fixme('dev: SFC styles reach the shell head before body streams (no FOUC)', async ({ fetch }) => {
    test.skip(!isDev, 'reproduces dev-only CSS flash; production extracts styles via inlineStyles')

    const res = await fetch('/styled')
    const html = await res.text()

    // Shell = everything before the first streamed body chunk. The bootstrap
    // <script> tag immediately after <body> marks the shell boundary.
    const shellEnd = html.indexOf('var __unhead_iife__')
    expect(shellEnd, 'shell boundary marker (IIFE) must exist').toBeGreaterThan(-1)
    const shell = html.slice(0, shellEnd)

    // Expectation: the SFC <style> block must be available before any
    // rendered DOM paints. Either inlined as <style> in <head>, or as a
    // <link rel="stylesheet"> to a real CSS asset (NOT a Vite JS module
    // ending in .ts/.js or carrying ?vue&type=style which is a JS injector).
    const inlineMatch = shell.match(/<style[^>]*>[^<]*\.css-flash-marker[^<]*<\/style>/)
    const linkHrefs = Array.from(shell.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)).map(m => m[1]!)

    let coveredByLink = false
    for (const href of linkHrefs) {
      // Vite dev serves SFC <style> as JS modules — those don't prevent FOUC.
      if (href.includes('type=style') || /\.m?[jt]sx?(?:\?|$)/.test(href)) { continue }
      const cssRes = await globalThis.fetch(new URL(href, res.url))
      const cssBody = await cssRes.text()
      if (cssBody.includes('.css-flash-marker')) {
        coveredByLink = true
        break
      }
    }

    expect(
      Boolean(inlineMatch) || coveredByLink,
      `SFC styles must reach the shell head as inline <style> or <link rel="stylesheet">. ` +
      `Inline match: ${Boolean(inlineMatch)}, link hrefs in shell: ${JSON.stringify(linkHrefs)}`,
    ).toBe(true)
  })

  test('bot user-agent falls back to buffered response', async ({ _nuxtHooks }) => {
    const url = _nuxtHooks.ctx.url!
    const res = await globalThis.fetch(new URL('/', url), {
      headers: {
        'accept': 'text/html',
        'user-agent': 'Googlebot/2.1',
      },
    })
    const html = await res.text()

    // Bot gets buffered response — no streaming bootstrap/IIFE
    expect(html).not.toContain('var __unhead_iife__')
    expect(html).not.toMatch(/<body[^>]*><script async src="[^"]*\.js"><\/script>/)
    // But still has the full HTML with head tags rendered directly
    expect(html).toContain('<title>Streaming Home</title>')
  })

  // An error thrown synchronously in page setup surfaces before the first body
  // chunk is read, so the shell is never committed — the renderer falls through
  // to the buffered error renderer and the correct status reaches the client.
  test('error before shell flush falls back to the buffered error renderer', async ({ _nuxtHooks }) => {
    const url = _nuxtHooks.ctx.url!
    const res = await globalThis.fetch(new URL('/error-before', url), {
      headers: { accept: 'text/html' },
    })
    const html = await res.text()

    expect(res.status).toBe(500)
    // Buffered error response — no streaming shell was committed
    expect(html).not.toContain('window.__unhead__={_q:[]')
    expect(html).not.toContain('window.__unhead__.push(')
  })

  // An async component inside `<Suspense>` resolves after the shell has flushed,
  // then fails. The HTTP status is already committed (200), so the error is
  // injected into the payload and the document is closed cleanly — the client
  // renders the error page during hydration.
  test('error during streaming commits 200 and injects the error into the payload', async ({ fetch }) => {
    const res = await fetch('/error-during')
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    // The shell streamed before the error occurred
    expect(html).toContain('window.__unhead__={_q:[],push(e){this._q.push(e)}}')
    expect(html).toContain('shell content before the error')
    // The error is carried in the payload for client-side error rendering
    expect(html).toContain('Mid-stream render failure')
    // The document is still well-formed despite the mid-stream failure
    expect(html.trimEnd()).toMatch(/<\/body><\/html>$/)
  })

  test('client renders the error page after a mid-stream error', async ({ page, goto }) => {
    await goto('/error-during')

    // `payload.error` drives the client to the error page during hydration
    await expect(page.locator('body')).toContainText('Mid-stream render failure')
    await expect(page.locator('[data-testid="shell-text"]')).toHaveCount(0)
  })

  // Streaming commits the HTTP status with the shell. A `setResponseStatus`
  // call after an `await` in page setup runs once the shell is already on the
  // wire, so it is dropped — whereas the buffered renderer applies it. The
  // `/late-status` page sets `418` after a delay.
  test('a post-await setResponseStatus is dropped when streaming, applied when buffered', async ({ _nuxtHooks }) => {
    const url = _nuxtHooks.ctx.url!

    // Streamed: status was committed at shell flush — the later 418 never lands
    const streamed = await globalThis.fetch(new URL('/late-status', url), {
      headers: { accept: 'text/html' },
    })
    expect(streamed.status).toBe(200)

    // Buffered (bot UA): the full render completes before the response is sent
    const buffered = await globalThis.fetch(new URL('/late-status', url), {
      headers: { 'accept': 'text/html', 'user-agent': 'Googlebot/2.1' },
    })
    expect(buffered.status).toBe(418)
  })

  // The streaming renderer emits inline scripts (bootstrap queue, IIFE, head
  // pushes) that bypass unhead. When a security module has stamped a nonce on
  // the head scripts, the renderer reuses it so a strict `script-src` policy
  // does not block them. The `/nonce` fixture plugin stamps `test-csp-nonce`.
  test('a head-script nonce is threaded onto streamed inline scripts', async ({ fetch }) => {
    const res = await fetch('/nonce')
    const html = await res.text()

    // Bootstrap queue carries the nonce
    expect(html).toMatch(/<script nonce="test-csp-nonce">window\.__unhead__=\{_q:\[\]/)
    // Streamed head-push chunks carry the nonce
    expect(html).toMatch(/<script nonce="test-csp-nonce">window\.__unhead__\.push/)

    if (!isDev) {
      // Production IIFE chunk is loaded as an external script — also nonced
      expect(html).toMatch(/<script async nonce="test-csp-nonce" src=/)
      // Route-level inline `<style>` carries the nonce too (strict `style-src`)
      expect(html).toMatch(/<style nonce="test-csp-nonce">[^<]*\.nonce-probe/)
    }
  })

  // The shell is flushed before render, so it only carries entry-chunk styles.
  // Route/layout styles are emitted once render has registered them — inlined
  // as `<style>` (matching `inlineStyles`) after the shell, outside `#__nuxt`.
  test('route-level CSS is streamed after the shell', async ({ fetch }) => {
    test.skip(isDev, 'dev serves SFC <style> as JS modules, not extracted CSS assets')

    const res = await fetch('/styled')
    const html = await res.text()

    // The `/styled` page `<style>` is inlined and streamed into the body —
    // the shell `<head>` only carried entry CSS.
    const afterHead = html.slice(html.indexOf('</head>'))
    expect(afterHead).toMatch(/<style[^>]*>[^<]*\.css-flash-marker/)
  })

  // FOUC footgun. Page- and layout-level `<style>` (like `/styled`) and even a
  // top-level async component register their modules as soon as render starts,
  // so the renderer inlines their CSS in the chunk right after the shell, ahead
  // of any DOM. A *nested* async component is different: it is only instantiated
  // once its async parent resolves, which happens after the first chunk has
  // streamed. Its module misses the post-shell styles chunk, so the renderer
  // emits its SFC `<style>` in the closing HTML — behind the component's own
  // DOM. The browser paints it unstyled until the final chunk arrives. `/fouc`
  // reproduces this: `FoucNestedParent` resolves, then renders the styled
  // `flashy`, while a slow sibling holds the stream open.
  test('async-component CSS streams behind its DOM (FOUC footgun)', async ({ fetch }) => {
    test.skip(isDev, 'dev serves SFC <style> as JS modules, not extracted CSS assets')

    const res = await fetch('/fouc')
    const html = await res.text()

    const domIdx = html.indexOf('data-testid="fouc-target"')
    expect(domIdx, 'styled async component must render').toBeGreaterThan(-1)

    const styleIdx = html.search(/<style[^>]*>[^<]*\.fouc-marker/)
    expect(styleIdx, 'the .fouc-marker <style> must be streamed').toBeGreaterThan(-1)

    // The footgun: the `<style>` lands after the component's DOM, so there is a
    // window where `flashy` is painted with no styling. Documented as a known
    // limitation under SSR streaming in the experimental-features guide.
    expect(
      styleIdx,
      'async-component CSS is streamed behind its DOM — paint-critical styles belong in global CSS',
    ).toBeGreaterThan(domIdx)
  })

  // The visual counterpart of the test above: drive a real browser and sample
  // the styled element while the rest of the document is still streaming. The
  // slow sibling on `/fouc` keeps the connection open long enough to observe
  // `flashy` painted before its `<style>` chunk arrives.
  test('async-component CSS visibly flashes unstyled mid-stream', async ({ page, _nuxtHooks }) => {
    test.skip(isDev, 'dev FOUC has a different cause (Vite JS-module styles); covered by the dev fixme')

    const url = _nuxtHooks.ctx.url!
    // `commit` resolves as soon as the response starts — before the stream ends.
    await page.goto(new URL('/fouc', url).href, { waitUntil: 'commit' })

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

  // `<Teleport to="body">` content is collected into `ssrContext.teleports`
  // and cannot be stitched into the body string mid-stream; the renderer
  // appends it after the app root closes, before `</body>`.
  test('Teleport-to-body content reaches the streamed document', async ({ fetch }) => {
    const res = await fetch('/teleport')
    const html = await res.text()

    expect(html).toContain('teleported to body')
    // Emitted outside the app root, before the closing tag
    const afterRoot = html.slice(html.indexOf('</div>', html.indexOf('id="__nuxt"')))
    expect(afterRoot).toContain('teleported to body')
  })

  test('Teleport-to-body hydrates into <body> without errors', async ({ page, goto }) => {
    const pageErrors: string[] = []
    page.on('pageerror', err => pageErrors.push(err.message))

    await goto('/teleport')

    const teleported = page.locator('[data-testid="teleported"]')
    await expect(teleported).toHaveText('teleported to body')
    // Lives directly under <body>, not inside #__nuxt
    expect(await teleported.evaluate(el => el.parentElement?.tagName)).toBe('BODY')
    expect(pageErrors, `pageerror events: ${pageErrors.join(' | ')}`).toEqual([])
  })

  // Modules drive the streaming response via three hooks: `render:html`
  // (pre-shell, with `streaming: true`), `render:html:chunk` (per-chunk byte
  // mutation), and `render:html:close` (final `bodyAppend`). The `/hooks`
  // fixture plugin exercises all three.
  test('render:html streaming hooks mutate the shell and document', async ({ fetch }) => {
    const res = await fetch('/hooks')
    const html = await res.text()

    // `render:html` ran with `streaming: true`; head + bodyPrepend reached the shell
    expect(html).toContain('<meta name="x-render-html" content="streaming">')
    expect(html).toContain('<!--render:html bodyPrepend-->')
    // `render:html:chunk` mutated the shell chunk's bytes
    expect(html).toContain('<!--chunk:0-->')
    // `render:html:close` injected bodyAppend before the closing tags
    expect(html).toMatch(/<!--render:html:close bodyAppend-->[\s\S]*<\/body>/)
  })

  // Island components are compatible with streaming: their teleported content
  // (slot markup, selective-client output) cannot be stitched into the body
  // string once it has streamed, so it is emitted as inert `<template>`s at the
  // end of the document and relocated into the island anchors by an inline
  // script that runs before hydration. The `/islands` page renders a plain
  // server component and a slot-bearing one.
  test('island page still streams', async ({ fetch }) => {
    const res = await fetch('/islands')
    const html = await res.text()

    expect(res.headers.get('transfer-encoding')).toBe('chunked')
    expect(html).toContain('window.__unhead__={_q:[],push(e){this._q.push(e)}}')
  })

  test('plain island renders its content inline', async ({ fetch }) => {
    const res = await fetch('/islands')
    const html = await res.text()

    expect(html).toMatch(/data-island-uid="[^"]*"> Island says: hello from server/)
  })

  test('island slot content is streamed as a relocation template', async ({ fetch }) => {
    const res = await fetch('/islands')
    const html = await res.text()

    // Slot content is teleported: emitted in a keyed <template> at end of body
    expect(html).toMatch(/<template data-island-uid="[^"]*" data-island-slot="default">/)
    expect(html).toContain('slotted from page')
    // The relocation script must ship to stitch it before hydration
    expect(html).toContain('template[data-island-uid]')
    // Static island markup itself still streams inline
    expect(html).toContain('island before slot')
    expect(html).toContain('island after slot')
  })

  test('island page hydrates with slot content in place and no errors', async ({ page, goto }) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', err => pageErrors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') { consoleErrors.push(msg.text()) }
    })

    await goto('/islands')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Streaming Islands Home')
    await expect(page.locator('[data-testid="island"]').first()).toContainText('hello from server')
    await expect(page).toHaveTitle('Streaming Islands')

    // Slot content was relocated into the island anchor, not left dangling
    const slotIsland = page.locator('[data-testid="slot-island"]').first()
    await expect(slotIsland).toContainText('island before slot')
    await expect(slotIsland.locator('[data-testid="slot-content"]')).toHaveText('slotted from page')

    // Relocation templates must be removed once stitched
    await expect(page.locator('template[data-island-uid]')).toHaveCount(0)

    expect(pageErrors, `pageerror events: ${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `console.error output: ${consoleErrors.join(' | ')}`).toEqual([])
  })

  // Selective-client islands: a `nuxt-client` component inside a server
  // component is teleported via the `uid;client` marker — a distinct path
  // from slot teleports. Streaming relocates it client-side, and it must
  // hydrate into a live, interactive component.
  test('selective-client island hydrates and stays interactive', async ({ fetch, page, goto }) => {
    const res = await fetch('/islands')
    const html = await res.text()

    // The client component ships as a `data-island-component` relocation template
    expect(html).toMatch(/<template data-island-uid="[^"]*" data-island-component="[^"]*">/)
    expect(html).toContain('server-rendered island shell')
    expect(html).toContain('count: 0')

    await goto('/islands')

    const counter = page.locator('[data-testid="island-counter"]').first()
    await expect(counter).toHaveText('count: 0')
    // Clicking proves the relocated client component is hydrated and reactive
    await counter.click()
    await expect(counter).toHaveText('count: 1')
  })
})
