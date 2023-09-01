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
    buildDir: process.env.NITRO_BUILD_DIR,
    nitro: { output: { dir: process.env.NITRO_OUTPUT_DIR } }
  }
})

describe('suspense multiple nav', () => {
  it.only('should not throw error', async () => {
    const { page, consoleLogs, pageErrors } = await renderPage('/')
    await page.waitForLoadState('networkidle')

    expect(await page.locator('#btn-a').textContent()).toMatchInlineSnapshot('" Target A "')
    // Make sure it navigates to the correct page
    await page.locator('#btn-a').click()
    console.log(page.url())
    expect(await page.locator('#content').textContent()).toContain('Hello a')
    await page.goBack()

    // When back
    expect(await page.locator('body').textContent()).toContain('Index Page')

    // So we click two navigations quickly, before the first one is resolved
    await page.locator('#btn-a').click()
    await page.locator('#btn-b').click()
    await new Promise(resolve => setTimeout(resolve, 200))

    const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
    const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')
    expect(pageErrors).toEqual([])
    expect(consoleLogErrors).toEqual([])
    expect(consoleLogWarnings).toEqual([])

    expect(await page.locator('#content').textContent()).toContain('Hello b')

    expect(consoleLogs)
      .toMatchInlineSnapshot()

    await page.close()
  }, 60_000)
})
