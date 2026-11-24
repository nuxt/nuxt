import { collectConsoleLogs, expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('chunk-error'),
  },
})

test.describe('chunk loading errors', () => {
  test('recovers state after a failed chunk load', async ({ page, goto }) => {
    // a failed CSS link preload must not break the page
    await page.route(/\.css/, route => route.abort('timedout'))
    await goto('/')
    expect(await page.innerText('div')).toContain('Some value: 1')
    const consoleLogs = collectConsoleLogs(page)

    await page.getByText('Increment state').click()
    await page.getByText('Increment state').click()
    expect(await page.innerText('div')).toContain('Some value: 3')

    await page.route(/.*/, route => route.abort('timedout'), { times: 1 })
    await page.getByText('Chunk error').click()

    await page.waitForURL(u => u.pathname === '/chunk-error')

    const logs = consoleLogs.map(log => log.text).join('')
    expect(logs).toContain('caught chunk load error')
    expect(logs).toContain('Failed to load resource')

    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/chunk-error')
    expect(await page.innerText('div')).toContain('Chunk error page')
    await page.locator('div').getByText('State: 3').waitFor()
  })
})
