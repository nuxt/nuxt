import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { setup } from '@nuxt/test-utils'
import { renderPage } from './utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/suspense', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
  },
})

describe('suspense multiple nav', () => {
  it('should not throw error', async () => {
    const { page, consoleLogs, pageErrors } = await renderPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(await page.locator('#btn-a').textContent()).toMatchInlineSnapshot('" Target A "')
    // Make sure it navigates to the correct page
    await page.locator('#btn-a').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/target')
    console.log(page.url())
    expect(await page.locator('#content').textContent()).toContain('Hello a')
    await page.goBack()

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')

    // When back
    expect(await page.locator('body').textContent()).toContain('Index Page')

    // So we click two navigations quickly, before the first one is resolved
    await Promise.all([
      page.locator('#btn-a').click(),
      page.locator('#btn-b').click(),
    ])

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/target')

    expect.soft(await page.locator('#content').textContent()).toContain('Hello b')

    const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
    const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')
    expect.soft(pageErrors).toEqual([])
    expect.soft(consoleLogErrors).toEqual([])
    expect.soft(consoleLogWarnings).toEqual([])

    await page.close()
  }, 60_000)
})
