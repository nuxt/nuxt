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
  })

  test('direct navigation to async page streams correctly', async ({ page, goto }) => {
    await goto('/async-head')

    await expect(page.locator('[data-testid="title"]').first()).toHaveText('Async Head Page')
    await expect(page.locator('[data-testid="content"]').first()).toHaveText('async-loaded')
    await expect(page).toHaveTitle('Async Head Title')
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
