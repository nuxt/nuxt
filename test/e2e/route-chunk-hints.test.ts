import type { Page } from '@playwright/test'
import { expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('route-chunk-hints'),
  },
})

interface PreloadHint { rel: string, as?: string, file: string }

const ASSETS_PATH = '/_nuxt/'

// the HTTP cache is turned off, so that a file fetched a second time is requested a second time
async function trackChunkRequests (page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  const requests: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith(ASSETS_PATH) && /\.(?:js|css)$/.test(pathname)) {
      requests.push(pathname.slice(ASSETS_PATH.length))
    }
  })
  return requests
}

async function readHints (page: Page, layout: string) {
  const { files, pages } = await page.evaluate((layout) => {
    const hints = JSON.parse(document.querySelector('script[data-nuxt-preload]')!.textContent!)
    return { files: (hints.layouts[layout] as number[]).map(index => hints.files[index] as PreloadHint), pages: hints.pages as string }
  }, layout)
  const pageHints = await page.request.get(pages).then(response => response.json()) as { files: PreloadHint[] }
  return { layout: files, pages: pageHints.files }
}

function readEffects (page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body)
    return {
      evaluated: performance.getEntriesByName('evaluated:layout').concat(performance.getEntriesByName('evaluated:page')).map(mark => mark.name),
      layoutStyles: style.caretColor === 'rgb(1, 2, 3)',
      pageStyles: style.accentColor === 'rgb(4, 5, 6)',
    }
  })
}

function fetchedFiles (page: Page) {
  return page.evaluate(assetsPath => performance.getEntriesByType('resource')
    .map(entry => new URL(entry.name).pathname)
    .filter(pathname => pathname.startsWith(assetsPath))
    .map(pathname => pathname.slice(assetsPath.length)), ASSETS_PATH)
}

function countRequests (requests: string[], files: string[]) {
  return Object.fromEntries(files.map(file => [file, requests.filter(request => request === file).length]))
}

test.describe('route chunk hints', () => {
  test('fetches the layout and page of a prefetched link once, without running them', async ({ page, goto }) => {
    const requests = await trackChunkRequests(page)
    await goto('/')

    const hints = await readHints(page, 'alt')
    const before = new Set(requests)
    const wanted = [...hints.layout, ...hints.pages].map(hint => hint.file).filter(file => !before.has(file))
    expect(wanted.some(file => file.endsWith('.js'))).toBe(true)
    expect(wanted.some(file => file.endsWith('.css'))).toBe(true)

    await page.hover('#other')
    await expect.poll(() => fetchedFiles(page)).toEqual(expect.arrayContaining(wanted))

    expect(await readEffects(page)).toEqual({ evaluated: [], layoutStyles: false, pageStyles: false })

    await page.click('#other')
    await expect(page.locator('#alt-layout #other-page')).toHaveText('Other page')

    const effects = await readEffects(page)
    expect(effects.evaluated).toEqual(['evaluated:layout', 'evaluated:page'])
    expect(effects).toMatchObject({ layoutStyles: true, pageStyles: true })
    expect(countRequests(requests, wanted)).toEqual(Object.fromEntries(wanted.map(file => [file, 1])))
  })

  test('leave a chunk whose hint failed to the navigation', async ({ page, goto }) => {
    const requests = await trackChunkRequests(page)
    await goto('/')

    const hints = await readHints(page, 'alt')
    const before = new Set(requests)
    const hint = [...hints.layout, ...hints.pages].find(hint => !before.has(hint.file) && hint.file.endsWith('.js'))!
    // Chromium keeps a `rel="preload"` that failed, and answers the request that needs the file
    // with it rather than asking for the file again
    test.fixme(hint.rel !== 'modulepreload', 'a failed `rel="preload"` fails the navigation that needs the file')
    const failing = hint.file
    await page.route(`**${ASSETS_PATH}${failing}`, route => route.abort('connectionreset'), { times: 1 })

    const failed = page.waitForEvent('requestfailed', request => request.url().endsWith(failing))
    await page.hover('#other')
    await failed
    // left in the document, the link would be taken to mean the chunk was fetched
    await expect(page.locator(`link[href$="${failing}"]`)).toHaveCount(0)

    await page.click('#other')
    await expect(page.locator('#alt-layout #other-page')).toHaveText('Other page')
    expect(countRequests(requests, [failing])).toEqual({ [failing]: 2 })
  })
})
