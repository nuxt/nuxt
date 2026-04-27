import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
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

  // Nitro serializes user-defined route rules as `{ name, options }` entries, so
  // `getRouteRules(...).routeRules.streaming` is an object — never `=== false` —
  // and `(routeOptions as { streaming?: boolean }).streaming !== false` always
  // passes. The opt-out branch is therefore unreachable today. Tracked as a real
  // bug to be fixed in renderer.ts; the assertions below describe the intended
  // contract so the test starts passing once the check is corrected.
  test.fixme('per-route streaming opt-out via routeRules', async ({ fetch }) => {
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
})
