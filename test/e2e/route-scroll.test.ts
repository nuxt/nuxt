import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  viewport: {
    width: 1000,
    height: 1000,
  },
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/route-scroll', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('route scroll behavior', () => {
  test('expect scroll to top on routes with same component', async ({ page, goto }) => {
    // #22402
    await goto('/big-page-1')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/big-page-1')

    await page.locator('#big-page-2').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#big-page-2').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/big-page-2')
    await page.waitForFunction(() => window.scrollY === 0)

    await page.locator('#big-page-1').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#big-page-1').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/big-page-1')
    await page.waitForFunction(() => window.scrollY === 0)
  })

  test('expect scroll to top on nested pages', async ({ page, goto }) => {
    // #20523
    await goto('/nested/foo/test')
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/test')

    await page.locator('#user-test').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#user-test').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/user-test')
    await page.waitForFunction(() => window.scrollY === 0)

    await page.locator('#test').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)
    await page.locator('#test').click()
    await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path, '/nested/foo/test')
    await page.waitForFunction(() => window.scrollY === 0)
  })

  test('should not scroll to top when `scrollToTop` is `false`', async ({ page, goto }) => {
    await goto('/route-scroll-behavior/scroll-to-top')

    await page.locator('#do-not-scroll-to-top').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)

    await page.click('#do-not-scroll-to-top')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/scroll-to-top/do-not-scroll-to-top'))

    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY !== 0).toBe(true)
  })

  test('should scroll to top when `scrollToTop` is `true`', async ({ page, goto }) => {
    await goto('/route-scroll-behavior/scroll-to-top')

    await page.locator('#scroll-to-top').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.scrollY > 0)

    await page.click('#scroll-to-top')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath.includes('/scroll-to-top/scroll-to-top'))

    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBe(0)
  })
})
