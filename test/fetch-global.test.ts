import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isBuilt, runsOncePerBuilderInMatrix } from './matrix'
import { renderPage } from './utils'

const shouldRun = runsOncePerBuilderInMatrix && isBuilt

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/fetch-global', import.meta.url)),
    dev: false,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('client `$fetch` global', () => {
  it('leaves `ofetch` out of the entry when only a lazy page reads `$fetch`', async () => {
    const scripts = async (path: string) => {
      const html = await $fetch<string>(path)
      const sources = [...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="([^"]+\.js)"/g)].map(match => match[1]!)
      return Promise.all(sources.map(src => $fetch<string>(src, { responseType: 'text' })))
    }
    expect((await scripts('/')).some(code => code.includes('[ofetch]'))).toBe(false)
    expect((await scripts('/global')).some(code => code.includes('[ofetch]'))).toBe(true)
  })

  it('does not install the global on a page that never reads it', async () => {
    const { page, pageErrors } = await renderPage('/plain')
    expect(await page.evaluate(() => typeof (window as unknown as { $fetch?: unknown }).$fetch)).toBe('undefined')
    expect(pageErrors).toEqual([])
    await page.close()
  })

  it('installs the global before a page that reads `window.$fetch` runs', async () => {
    const { page, pageErrors } = await renderPage('/global')
    await page.waitForFunction(() => document.querySelector('#result')?.textContent?.trim() === 'hello')
    expect(pageErrors).toEqual([])
    await page.close()
  })

  it('installs the global when navigating to a page that reads it', async () => {
    const { page, pageErrors } = await renderPage('/')
    await page.click('#to-global')
    await page.waitForFunction(() => document.querySelector('#result')?.textContent?.trim() === 'hello')
    expect(pageErrors).toEqual([])
    await page.close()
  })

  it('calls an auto-imported `$fetch` on a page that never reads the global', async () => {
    const { page, pageErrors } = await renderPage('/bare')
    await page.waitForFunction(() => document.querySelector('#bare')?.textContent?.trim() === 'hello')
    expect(pageErrors).toEqual([])
    await page.close()
  })

  it('keeps the auto-imported `$fetch` and the global the same instance', async () => {
    const { page } = await renderPage('/same')
    await page.waitForFunction(() => document.querySelector('#same')?.textContent?.trim() === 'true')
    await page.close()
  })
})
