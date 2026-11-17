import type { Page } from 'playwright-core'
import { waitForHydration } from '@nuxt/test-utils'
import { expect, fixtureDir, test } from './test-utils'

const loaderHTML = '<div id="__nuxt"><div data-testid="loader">loading...</div></div>'

test.use({
  nuxt: {
    rootDir: fixtureDir('spa-loader'),
  },
})

// a snapshot rather than an auto-waiting assertion: https://github.com/nuxt/nuxt/pull/31273#issuecomment-2731002417
async function getState (page: Page) {
  const [loader, content] = await Promise.all([
    page.getByTestId('loader').isVisible(),
    page.getByTestId('content').isVisible(),
  ])
  return { loader, content }
}

test.describe('spaLoadingTemplateLocation flag is set to `within`', () => {
  test('should render the loader inside the app tag, which the mounting app replaces', async ({ page, fetch }) => {
    expect(await fetch('/spa').then(r => r.text())).toContain(loaderHTML)

    await page.goto('/spa')
    await expect(page.getByTestId('loader')).toBeHidden()
    await expect(page.getByTestId('content')).toBeHidden()
    expect(await getState(page)).toEqual({ loader: false, content: false })

    page.dispatchEvent('html', 'finishHydration')
    await waitForHydration(page, '/spa', 'hydration')

    await expect(page.getByTestId('content')).toBeVisible()
  })

  test('should render content without spa-loader for SSR pages', async ({ page, fetch }) => {
    expect(await fetch('/ssr').then(r => r.text())).not.toContain(loaderHTML)

    await page.goto('/ssr')
    expect(await getState(page)).toEqual({ loader: false, content: true })
  })
})
