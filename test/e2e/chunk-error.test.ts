import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures/chunk-error', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('chunk loading errors', () => {
  test('recovers state after a failed chunk load', async ({ page, baseURL }) => {
    const consoleLogs: string[] = []
    page.on('console', msg => consoleLogs.push(msg.text()))

    // verify CSS link preload failure doesn't break the page
    await page.route(/\.css/, route => route.abort('timedout'))
    await page.goto(baseURL!)
    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/' && !window.useNuxtApp?.().isHydrating)
    expect(await page.innerText('div')).toContain('Some value: 1')
    consoleLogs.length = 0

    await page.getByText('Increment state').click()
    await page.getByText('Increment state').click()
    expect(await page.innerText('div')).toContain('Some value: 3')

    await page.route(/.*/, route => route.abort('timedout'), { times: 1 })
    await page.getByText('Chunk error').click()

    await page.waitForURL(u => u.pathname === '/chunk-error')

    const logs = consoleLogs.join('')
    expect(logs).toContain('caught chunk load error')
    expect(logs).toContain('Failed to load resource')

    await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath === '/chunk-error')
    expect(await page.innerText('div')).toContain('Chunk error page')
    await page.locator('div').getByText('State: 3').waitFor()
  })
})
