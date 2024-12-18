import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import type { Page } from 'playwright-core'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

await setup({
  rootDir: fileURLToPath(new URL('../fixtures/spa-loader', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
    spaLoadingTemplate: true,
    experimental: {
      spaLoadingTemplateLocation: 'body',
    },
  },
})

describe('spaLoadingTemplateLocation flag is set to `body`', () => {
  it('should render spa-loader', async () => {
    const page = await createPage()
    await page.goto(url('/spa'), { waitUntil: 'domcontentloaded' })

    const loader = page.getByTestId('loader')
    const content = page.getByTestId('content')

    await loader.waitFor({ state: 'visible' })
    expect(await content.isHidden()).toBeTruthy()

    await content.waitFor({ state: 'visible' })
    expect(await loader.isHidden()).toBeTruthy()

    await page.close()
  }, 60_000)

  it('should render content without spa-loader', async () => {
    const page = await createPage()
    await page.goto(url('/ssr'), { waitUntil: 'domcontentloaded' })

    const [loaderIsHidden, contentIsHidden] = await getState(page)

    expect(loaderIsHidden).toBeTruthy()
    expect(contentIsHidden).toBeFalsy()

    await page.close()
  }, 60_000)
})

function getState (page: Page) {
  const loader = page.getByTestId('loader')
  const content = page.getByTestId('content')

  return Promise.all([
    loader.isHidden(),
    content.isHidden(),
  ])
}
