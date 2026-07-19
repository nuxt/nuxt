import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  locale: 'en-GB',
  timezoneId: 'UTC',
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/nuxt-time', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

function hydrationLogs (page: Page) {
  // @ts-expect-error untyped
  const logs = (page._consoleLogs ?? []) as Array<{ type: string, text: string }>
  return logs.filter(log => !log.text.includes('<Suspense>') && !log.text.includes('[vite]'))
}

test.describe('nuxt-time', () => {
  test('has no hydration errors on the client', async ({ page, goto }) => {
    await goto('/')

    expect(await page.getByTestId('switchable').textContent()).toBe('11 February at 8')
    expect(await page.getByTestId('fixed').textContent()).toBe('11 February')

    await page.getByText('Switch locale').click()
    expect(await page.getByTestId('switchable').textContent()).toBe('11 février à 8')
    expect(await page.getByTestId('fixed').textContent()).toBe('11 février')

    await page.getByText('Update time').click()
    expect(await page.getByTestId('switchable').textContent()).not.toEqual('11 février à 8')
    expect(await page.getByTestId('fixed').textContent()).toBe('11 février')

    expect(hydrationLogs(page).map(log => log.text)).toEqual([])
  })

  test('displays relative time correctly', async ({ page, goto }) => {
    await goto('/')

    expect(await page.getByTestId('relative').textContent()).toBe('30 seconds ago')

    // Wait for the relative time to tick at least once. Under CI load `setInterval`
    // can be delayed enough that `Math.round` skips a value (e.g. 30 → 31 → 33).
    await expect.poll(() => page.getByTestId('relative').textContent(), { timeout: 10_000 }).toMatch(/3[1-9] seconds ago/)

    expect(hydrationLogs(page).map(log => log.text)).toEqual([])
  })
})
