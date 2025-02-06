import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, createPage, fetch, setup, url } from '@nuxt/test-utils/e2e'
import { expectWithPolling } from '../utils'

const isWebpack =
  process.env.TEST_BUILDER === 'webpack' ||
  process.env.TEST_BUILDER === 'rspack'

const isDev = process.env.TEST_ENV === 'dev'

await setup({
  rootDir: fileURLToPath(new URL('../fixtures/spa-loader', import.meta.url)),
  dev: isDev,
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
    spaLoadingTemplate: true,
    experimental: {
      spaLoadingTemplateLocation: 'within',
    },
  },
})

describe('spaLoadingTemplateLocation flag is set to `within`', () => {
  it.runIf(isDev)('should load dev server', async () => {
    await expectWithPolling(() => fetch('/').then(r => r.status === 200).catch(() => null), true)
  })
  it('should render loader inside appTag', async () => {
    const html = await $fetch<string>('/spa')
    expect(html).toContain(`<div id="__nuxt"><div data-testid="loader">loading...</div></div>`)
  })

  it('spa-loader does not appear while the app is mounting', async () => {
    const page = await createPage()
    await page.goto(url('/spa'))

    const loader = page.getByTestId('loader')
    const content = page.getByTestId('content')

    await loader.waitFor({ state: 'visible' })
    expect(await content.isHidden()).toBeTruthy()

    await page.waitForFunction(() => window.useNuxtApp?.() && window.useNuxtApp?.().isHydrating)

    expect(await content.isHidden()).toBeTruthy()

    await content.waitFor({ state: 'visible' })

    await page.close()
  }, 60_000)
})
