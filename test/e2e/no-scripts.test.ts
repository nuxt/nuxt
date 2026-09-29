import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/no-scripts', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('noScripts route rules', () => {
  test('serves a noScripts route without any scripts', async ({ fetch }) => {
    const html = await (await fetch('/no-scripts')).text()

    expect(html).toContain('No scripts page')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('type="importmap"')
    expect(html).not.toContain('__NUXT_DATA__')
  })

  test('scopes noScripts-page speculation rules to page routes and emits a view transition', async ({ fetch }) => {
    const html = await (await fetch('/no-scripts')).text()

    expect(html).toContain('type="speculationrules"')
    // scoped to same-origin page routes (safe to GET), never a blanket `/*`
    // that could reach non-idempotent server routes
    expect(html).toContain('"href_matches":"/report"')
    expect(html).toContain('"href_matches":"/products/:id"')
    expect(html).not.toContain('"href_matches":"/*"')
    expect(html).toContain('@view-transition{navigation:auto}')
  })

  test('serves a dynamic-param route under a noScripts glob without any scripts', async ({ fetch }) => {
    const html = await (await fetch('/products/123')).text()

    expect(html).toContain('Product 123')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('__NUXT_DATA__')
  })

  test('emits speculation rules scoped to noScripts patterns on a scripted page', async ({ fetch }) => {
    const html = await (await fetch('/')).text()

    // scripted pages keep their client runtime
    expect(html).toContain('type="module"')

    expect(html).toContain('type="speculationrules"')
    expect(html).toContain('"href_matches":"/no-scripts"')
    expect(html).toContain('"href_matches":"/no-scripts/*"')
    expect(html).toContain('"href_matches":"/aliased"')
    expect(html).toContain('"href_matches":"/products/*"')
    // scoped, never the blanket rule the noScripts pages themselves emit
    expect(html).not.toContain('"href_matches":"/*"')
    expect(html).toContain('@view-transition{navigation:auto}')
  })

  test('client-side navigation to a dynamic-param noScripts route triggers a full document load', async ({ page, goto }) => {
    await goto('/')
    await page.evaluate(() => { (window as any).__marker = 'kept' })

    await page.click('#link-product')
    await page.waitForURL(url => url.pathname === '/products/123')
    await page.locator('#product-page').waitFor()

    expect(await page.evaluate(() => (window as any).__marker)).toBeUndefined()
    expect(await page.evaluate(() => (window as any).useNuxtApp)).toBeUndefined()
  })

  test('client-side navigation to a noScripts route triggers a full document load', async ({ page, goto }) => {
    await goto('/')
    await page.evaluate(() => { (window as any).__marker = 'kept' })

    await page.click('#link-no-scripts')
    await page.waitForURL(url => url.pathname === '/no-scripts')
    await page.locator('#no-scripts-page').waitFor()

    // a full document load discards the marker set on the previous document
    expect(await page.evaluate(() => (window as any).__marker)).toBeUndefined()
    // and the destination genuinely ships no client runtime
    expect(await page.evaluate(() => (window as any).useNuxtApp)).toBeUndefined()
  })

  test('a non-noScripts alias of a noScripts page still renders client-side', async ({ page, goto }) => {
    await goto('/')
    await page.evaluate(() => { (window as any).__marker = 'kept' })

    // the alias is not covered by a route rule, so navigation stays a SPA transition
    await page.click('#link-aliased-alt')
    await page.waitForURL(url => url.pathname === '/aliased-alt')
    await page.locator('#aliased-page').waitFor()
    expect(await page.evaluate(() => (window as any).__marker)).toBe('kept')

    // the canonical path is served without scripts, so it forces a document load
    await goto('/')
    await page.evaluate(() => { (window as any).__marker = 'kept' })
    await page.click('#link-aliased')
    await page.waitForURL(url => url.pathname === '/aliased')
    await page.locator('#aliased-page').waitFor()
    expect(await page.evaluate(() => (window as any).__marker)).toBeUndefined()
  })
})
