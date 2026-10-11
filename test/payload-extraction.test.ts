import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, createPage, fetch, setup } from '@nuxt/test-utils/e2e'
import type { Page, Response as PlaywrightResponse } from 'playwright-core'

import { isDev, runsOncePerEnvInMatrix } from './matrix'
import { parsePayload } from './utils'

if (runsOncePerEnvInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/payload-extraction', import.meta.url)),
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

// a prefetched payload is retained once its body has been read and parsed, which happens
// after the response settles, so wait for the body and let the page run its pending tasks
async function waitForRetainedPayload (page: Page, response: PlaywrightResponse) {
  await response.finished()
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve)))
}

describe.skipIf(!runsOncePerEnvInMatrix)('payloadExtraction: \'always\'', () => {
  it('renders a payload at runtime for a route that is neither prerendered nor cached', async () => {
    const res = await fetch('/data/_payload.json')
    expect(res.headers.get('content-type')).toContain('application/json')
    const data = parsePayload(await res.text())
    expect(data.data['data-hits']).toMatchObject({ hits: expect.any(Number) })
  })

  it('consumes the prefetched payload on navigation without another server render', async () => {
    const page = await createPage('/')
    // the payload is prefetched when the link becomes visible
    const response = await page.waitForResponse(response => response.url().includes('/data/_payload.json'))
    await waitForRetainedPayload(page, response)
    const { hits } = await $fetch<{ hits: number }>('/api/data-hits')
    expect(hits).toBeGreaterThan(0)

    await page.click('[href="/data"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="hits"]')?.textContent?.trim())

    // the page rendered the prefetched data without a new render of the payload or the data
    expect(await page.locator('[data-testid="hits"]').textContent().then(t => t?.trim())).toBe(String(hits))
    expect(await $fetch<{ hits: number }>('/api/data-hits')).toEqual({ hits })
    await page.close()
  })

  it('prefetches the payload rendered for the query of the link', async () => {
    const page = await createPage('/')
    const response = await page.waitForResponse(response => response.url().includes('/search/_payload.json'))
    expect(new URL(response.url()).searchParams.get('q')).toBe('b')
    await waitForRetainedPayload(page, response)

    await page.click('[href="/search?q=b"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="search"]')?.textContent?.trim())
    expect(await page.locator('[data-testid="search"]').textContent().then(t => t?.trim())).toBe('b')
    await page.close()
  })

  it('discards prefetched payloads that the next navigation does not use', async () => {
    const page = await createPage('/')
    const response = await page.waitForResponse(response => response.url().includes('/data/_payload.json'))
    await waitForRetainedPayload(page, response)
    const { hits: prefetchedHits } = await $fetch<{ hits: number }>('/api/data-hits')

    // leave for a page that does not prefetch /data, then navigate to it
    await page.click('[href="/search?q=b"]')
    await page.waitForSelector('[data-testid="search"]', { state: 'attached' })
    await page.click('[href="/data"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="hits"]')?.textContent?.trim())

    // the data was fetched again rather than taken from the payload prefetched on the first page
    const shownHits = Number(await page.locator('[data-testid="hits"]').textContent())
    expect(shownHits).toBeGreaterThan(prefetchedHits)
    expect(await $fetch<{ hits: number }>('/api/data-hits')).toEqual({ hits: shownHits })
    await page.close()
  })
})
