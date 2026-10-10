import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, createPage, fetch, setup } from '@nuxt/test-utils/e2e'

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
    await page.waitForResponse(response => response.url().includes('/data/_payload.json'))
    const { hits } = await $fetch<{ hits: number }>('/api/data-hits')
    expect(hits).toBeGreaterThan(0)

    await page.click('[href="/data"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="hits"]')?.textContent?.trim())

    // the page rendered the prefetched data without a new render of the payload or the data
    expect(await page.locator('[data-testid="hits"]').textContent().then(t => t?.trim())).toBe(String(hits))
    expect(await $fetch<{ hits: number }>('/api/data-hits')).toEqual({ hits })
    await page.close()
  })
})
