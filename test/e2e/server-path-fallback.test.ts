import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/server-path-fallback', import.meta.url))

// parallel dev servers race on the fixture's `.nuxt` directory
test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

/** Document requests the browser makes after the initial page load. */
function trackDocumentLoads (page: import('@playwright/test').Page) {
  const loads: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest()) {
      loads.push(new URL(request.url()).pathname)
    }
  })
  return loads
}

test.describe('server path fallback', () => {
  test('loads a file from `public/` as a document instead of showing the error page', async ({ page, goto }) => {
    await goto('/')
    const loads = trackDocumentLoads(page)

    await page.click('#asset')
    await expect.poll(() => page.textContent('body')).toContain('proposal contents')

    expect(loads).toEqual(['/proposal.txt'])
    expect(page.url()).toContain('/proposal.txt')
  })

  test('returns to the previous page on back', async ({ page, goto }) => {
    await goto('/')

    await page.click('#asset')
    await expect.poll(() => page.textContent('body')).toContain('proposal contents')
    await page.goBack()

    await expect(page.locator('h1')).toHaveText('Server path fallback')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('still navigates to a real route on the client', async ({ page, goto }) => {
    await goto('/')
    const loads = trackDocumentLoads(page)

    await page.click('#page')
    await expect.poll(() => page.url()).toContain('/about')

    expect(loads).toEqual([])
    expect(await page.textContent('#about-page')).toContain('About page')
  })

  test('loads a `GET` server route as a document', async ({ page, goto }) => {
    await goto('/')
    const loads = trackDocumentLoads(page)

    await page.click('#server-route')
    await expect.poll(() => page.textContent('body')).toContain('feed contents')

    expect(loads).toEqual(['/rss.xml'])
    expect(page.url()).toContain('/rss.xml')
  })

  test('loads a server route with a parameter as a document', async ({ page, goto }) => {
    await goto('/')
    const loads = trackDocumentLoads(page)

    await page.click('#dynamic-server-route')
    await expect.poll(() => page.textContent('body')).toContain('og image for hello')

    expect(loads).toEqual(['/og/hello'])
    expect(page.url()).toContain('/og/hello')
  })

  test('loads an unmatched path as a document, which renders the error page', async ({ page, goto }) => {
    await goto('/')
    const loads = trackDocumentLoads(page)

    await page.click('#missing')
    await expect.poll(() => page.textContent('body')).toContain('Page not found: /definitely-not-a-route')

    expect(loads).toEqual(['/definitely-not-a-route'])
  })

  test.describe('built', () => {
    test.skip(({ isDev }) => isDev, 'the SPA fallback shell is prerendered')

    test('reloads at most once when served the SPA fallback shell', async ({ page, goto, baseURL }) => {
      const shell = await page.request.get(new URL('/200.html', baseURL).href).then(res => res.text())
      await goto('/')
      const loads = trackDocumentLoads(page)

      await page.route('**/definitely-not-a-route', route => route.request().isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: 'text/html', body: shell })
        : route.continue())

      await page.click('#missing')
      await expect.poll(() => page.textContent('body')).toContain('Page not found: /definitely-not-a-route')

      expect(loads).toEqual(['/definitely-not-a-route'])
    })
  })
})
