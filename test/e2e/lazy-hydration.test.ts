import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'
import { isWindows } from 'std-env'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/lazy-hydration', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('lazy hydration styles', () => {
  test.skip(({ builder, isDev }) => builder !== 'vite' || isDev, 'inline styles behaviour is tested against vite production builds')

  test('should include CSS link for hydrate-never component when inlineStyles is false', async ({ page }) => {
    await page.goto('/')

    // Component HTML should be rendered
    await expect(page.locator('.hydrate-never-component')).toBeVisible()
    await expect(page.getByText('Hydrate Never')).toBeVisible()

    // CSS should be linked (not inlined, since inlineStyles: false)
    const styleLink = page.locator('link[rel="stylesheet"]').first()
    await expect(styleLink).toBeAttached()

    // The CSS file should contain our component styles
    const href = await styleLink.getAttribute('href')
    expect(href).toBeTruthy()

    const cssResponse = await page.request.get(href!)
    const css = await cssResponse.text()
    expect(css).toContain('.hydrate-never-component')
  })

  // https://github.com/nuxt/nuxt/issues/35145
  test('should not preload JS chunk for hydrate-on-visible component', async ({ page, fetch }) => {
    const html = await fetch('/').then(r => r.text())
    const head = html.match(/<head[^>]*>[\s\S]*?<\/head>/)?.[0] ?? ''
    const modulepreloads = [...head.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(m => m[1]!)
    for (const href of modulepreloads) {
      const js = await page.request.get(href).then(r => r.text())
      expect(js).not.toContain('hydrate-on-visible-component')
    }
  })
})

const hydrationTests = {
  'in template': '',
  'with vue macros': '/macro',
}

for (const [description, path] of Object.entries(hydrationTests)) {
  test.describe(`delayed hydration components ${description}`, () => {
    test('lazy load delayed hydration comps at the right time', async ({ page, goto, fetch }) => {
      const html = await fetch(`/delayed-hydration${path}`).then(r => r.text())

      const hydratedText = 'This is mounted.'
      const unhydratedText = 'This is not mounted.'

      expect.soft(html).toContain(unhydratedText)
      expect.soft(html).not.toContain(hydratedText)

      await goto(`/delayed-hydration${path}`)

      await page.locator('data-testid=hydrate-on-visible', { hasText: hydratedText }).waitFor()
      expect.soft(await page.locator('data-testid=hydrate-on-visible-bottom').textContent().then(r => r?.trim())).toBe(unhydratedText)

      await page.locator('data-testid=hydrate-on-interaction-default', { hasText: unhydratedText }).waitFor()
      await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor()

      await page.locator('data-testid=hydrate-when-always', { hasText: hydratedText }).waitFor()
      await page.locator('data-testid=hydrate-when-state', { hasText: unhydratedText }).waitFor()

      const component = page.getByTestId('hydrate-on-interaction-default')
      await component.hover()
      await page.locator('data-testid=hydrate-on-interaction-default', { hasText: hydratedText }).waitFor()

      await page.getByTestId('button-increase-state').click()
      await page.locator('data-testid=hydrate-when-state', { hasText: hydratedText }).waitFor()

      await page.getByTestId('hydrate-on-visible-bottom').scrollIntoViewIfNeeded()
      await page.locator('data-testid=hydrate-on-visible-bottom', { hasText: hydratedText }).waitFor()

      await page.locator('data-testid=hydrate-never', { hasText: unhydratedText }).waitFor()
    })

    test('respects custom delayed hydration triggers and overrides defaults', async ({ page, goto }) => {
      await goto(`/delayed-hydration${path}`)

      const unhydratedText = 'This is not mounted.'
      const hydratedText = 'This is mounted.'

      await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'visible' })

      await page.getByTestId('hydrate-on-interaction-click').hover()
      await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'visible' })

      await page.getByTestId('hydrate-on-interaction-click').click()
      await page.locator('data-testid=hydrate-on-interaction-click', { hasText: hydratedText }).waitFor({ state: 'visible' })
      await page.locator('data-testid=hydrate-on-interaction-click', { hasText: unhydratedText }).waitFor({ state: 'hidden' })
    })

    if (description === 'in template') {
      test('does not delay hydration of components named after modifiers', async ({ page, goto }) => {
        await goto('/delayed-hydration')

        await page.locator('data-testid=event-view-normal-component', { hasText: 'This is mounted.' }).waitFor()
        await page.locator('data-testid=event-view-normal-component', { hasText: 'This is not mounted.' }).waitFor({ state: 'hidden' })
      })
    }

    test('handles time-based hydration correctly', async ({ page, goto, fetch }) => {
      const unhydratedText = 'This is not mounted.'
      const html = await fetch(`/delayed-hydration${path}/time`).then(r => r.text())
      expect(html).toContain(unhydratedText)

      await goto(`/delayed-hydration${path}/time`)

      const hydratedText = 'This is mounted.'
      await page.locator('[data-testid=hydrate-after]', { hasText: hydratedText }).waitFor({ state: 'visible' })

      // @ts-expect-error untyped
      const consoleLogs: Array<{ type: string, text: string }> = page._consoleLogs
      const hydrationLogs = consoleLogs.filter(log => !log.text.includes('[vite]') && !log.text.includes('<Suspense>'))
      expect(hydrationLogs.map(log => log.text)).toEqual([])
    })

    test('keeps reactivity with models', async ({ page, goto }) => {
      await goto(`/delayed-hydration${path}/model-event`)

      const countLocator = page.getByTestId('count')
      const incrementButton = page.getByTestId('increment')

      await countLocator.waitFor()
      expect(await countLocator.textContent()).toBe('0')

      // The first interaction triggers hydration asynchronously, and the click
      // that triggers it is not guaranteed to also register as an increment.
      // Hover to start hydration, then click until the count actually advances
      // before driving the deterministic loop below.
      await incrementButton.hover()
      await expect.poll(async () => {
        await incrementButton.click()
        return countLocator.textContent()
      }).not.toBe('0')

      let count = Number(await countLocator.textContent())
      while (count < 10) {
        await incrementButton.click()
        await expect.poll(() => countLocator.textContent()).toBe(`${++count}`)
      }

      expect(await countLocator.textContent()).toBe('10')
    })

    test('emits hydration events', async ({ page, goto }) => {
      await goto(`/delayed-hydration${path}/model-event`)

      // @ts-expect-error untyped
      const consoleLogs: Array<{ type: string, text: string }> = page._consoleLogs
      const initialLogs = consoleLogs.filter(log => log.type === 'log' && log.text === 'Component hydrated')
      expect(initialLogs.length).toBe(0)

      await page.getByTestId('count').click()

      // Wait for all pending micro ticks to be cleared in case hydration hasn't finished yet.
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)))
      const hydrationLogs = consoleLogs.filter(log => log.type === 'log' && log.text === 'Component hydrated')
      expect(hydrationLogs.length).toBeGreaterThan(0)
    })
  })
}
