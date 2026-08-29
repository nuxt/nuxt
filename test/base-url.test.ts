import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, getBrowser, setup, startServer, url } from '@nuxt/test-utils/e2e'

import { isWebpack, runsOncePerBuilderInMatrix } from './matrix'

// The axis that matters for base URL routing is the nitro pipeline (`nitroViteEnvironment`), which
// decides whether the SSR renderer is the only route registered. Base URLs with webpack/rspack are
// covered by `dynamic-paths`.
const runs = runsOncePerBuilderInMatrix && !isWebpack

if (runs) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/base-url', import.meta.url)),
    dev: false,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runs)('base URL set at build time', () => {
  it('should server-render pages under the base URL', async () => {
    const html = await $fetch<string>('/foo/')
    expect(html).toContain('data-testid="path">/<')
    expect(html).toContain('href="/foo/other"')

    const other = await $fetch<string>('/foo/other')
    expect(other).toContain('other page')
  })

  it('should not serve pages outside the base URL', async () => {
    expect((await fetch('/other', { redirect: 'manual' })).status).toBe(302)
    expect((await fetch('/foo/nonexistent')).status).toBe(404)
  })

  it('should serve assets under the base URL', async () => {
    const html = await $fetch<string>('/foo/')
    const urls = Array.from(html.matchAll(/(?:href|src)="([^"]+)"/g), m => m[1]!).filter(url => !url.startsWith('data:'))
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url).toMatch(/^\/foo\//)
      expect((await fetch(url)).status).toBe(200)
    }
  })

  it('should apply route rules to paths relative to the base URL', async () => {
    expect(await $fetch<string>('/foo/no-ssr')).toContain('data-ssr="false"')
  })

  it('should prerender routes relative to the base URL', async () => {
    const html = await $fetch<string>('/foo/prerendered')
    expect(html).toContain('prerendered')
    expect(html).toContain('"prerenderedAt"')
  })

  it('should render the error page under the base URL', async () => {
    const res = await fetch('/foo/nonexistent', { headers: { accept: 'text/html' } })
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<div id="__nuxt">')
  })

  it('should hydrate and navigate on the client under the base URL', async () => {
    const browser = await getBrowser()
    const page = await browser.newPage({})
    const errors: string[] = []
    const requests: string[] = []

    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        errors.push(message.text())
      }
    })
    page.on('request', request => requests.push(request.url().replace(url('/'), '/')))

    await page.goto(url('/foo/'))
    await page.waitForFunction(() => !!window.useNuxtApp?.() && !window.useNuxtApp!().isHydrating)
    expect(await page.getByTestId('path').textContent()).toContain('/')

    await page.getByRole('link', { name: 'other' }).click()
    await page.waitForFunction(() => window.location.pathname === '/foo/other')
    expect(await page.getByTestId('other').textContent()).toContain('other page')

    await page.goBack()
    await page.getByRole('link', { name: 'prerendered' }).click()
    await page.waitForFunction(() => window.location.pathname === '/foo/prerendered')
    expect(await page.getByTestId('prerendered').textContent()).toContain('prerendered')
    expect(requests.some(request => request.startsWith('/foo/prerendered/_payload.json'))).toBe(true)

    expect(errors).toEqual([])
    expect(requests.filter(request => !request.startsWith('/foo/'))).toEqual([])

    await page.close()
  })

  it('should keep serving the build-time base URL when it is overridden at runtime', async () => {
    await startServer({
      env: {
        NUXT_APP_BASE_URL: '/bar/',
      },
    })

    // `experimental.runtimeBaseURL` is needed to move the app at runtime
    expect((await fetch('/bar/', { redirect: 'manual' })).status).toBe(302)
    expect(await $fetch<string>('/foo/')).toContain('data-testid="path">/<')

    await startServer()
  })
})
