import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { getBrowser, setup, url } from '@nuxt/test-utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/spa-loader', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
    ssr: true,
    spaLoadingTemplate: true,
  },
})

describe('spa-loader with SSR', () => {
  it('should render content without spa-loader', async () => {
    const browser = await getBrowser()
    const page = await browser.newPage({})
    await page.goto(url('/'), { waitUntil: 'domcontentloaded' })

    const loader = page.getByTestId('__nuxt-spa-loader')
    expect(await loader.isVisible()).toBeFalsy()

    const content = page.getByTestId('content')
    await content.waitFor({ state: 'visible' })
    expect(await loader.isHidden()).toBeTruthy()

    await page.close()
  }, 60_000)
})
