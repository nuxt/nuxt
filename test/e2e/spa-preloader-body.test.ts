import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import type { Page } from 'playwright-core'
import { expect, test } from './test-utils'

/**
 * This test suite verifies that the SPA loading template is correctly rendered
 * outside the app tag when spaLoadingTemplateLocation is set to 'body'.
 */

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'
const isDev = process.env.TEST_ENV === 'dev'

const fixtureDir = fileURLToPath(new URL('../fixtures/spa-loader', import.meta.url))

// Skip tests in dev mode
test.skip(isDev, 'These tests are only relevant in production mode')

const loaderHTML = '<div id="__nuxt"></div><div id="__nuxt-loader"><div data-testid="loader">loading...</div></div>'

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
      builder: isWebpack ? 'webpack' : 'vite',
      spaLoadingTemplate: true,
      experimental: {
        spaLoadingTemplateLocation: 'body',
      },
    },
  },
})

test.describe('spaLoadingTemplateLocation flag is set to `body`', () => {
  test('should render loader alongside appTag', async ({ request }) => {
    const response = await request.get('/spa')
    const html = await response.text()

    expect(html).toContain(loaderHTML)
  })

  test('should render spa-loader', async ({ page, fetch }) => {
    expect(await fetch('/spa').then(r => r.text())).toContain(loaderHTML)

    // Navigate to the SPA page
    await page.goto('/spa')

    // Verify the loader is visible first and content is hidden
    const snapshot = await getState(page)
    expect(snapshot.loader).toBeTruthy()
    expect(snapshot.content).toBeFalsy()

    // Wait for content to become visible after hydration
    await expect(page.getByTestId('content')).toBeVisible()

    // Verify the loader is now hidden
    await expect(page.getByTestId('loader')).toBeHidden()
  })

  test('should render content without spa-loader for SSR pages', async ({ page, fetch }) => {
    expect(await fetch('/ssr').then(r => r.text())).not.toContain(loaderHTML)

    // Navigate to SSR page
    await page.goto('/ssr')

    // Verify the loader is hidden and content is visible for SSR pages
    const snapshot = await getState(page)
    expect(snapshot.loader).toBeFalsy()
    expect(snapshot.content).toBeTruthy()
  })
})

async function getState (page: Page) {
  const [loader, content] = await Promise.all([
    page.getByTestId('loader').isVisible(),
    page.getByTestId('content').isVisible(),
  ])
  const state = {
    loader,
    content,
  }
  return state
}
