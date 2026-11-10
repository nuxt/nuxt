import { consoleLogs, expect, fixtureDir, test } from './test-utils'

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir('lazy-hydration'),
  },
})

test.describe('lazy hydration styles', () => {
  test.skip(({ builder, isDev }) => builder !== 'vite' || isDev, 'inline styles behaviour is tested against vite production builds')

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

  // https://github.com/nuxt/nuxt/issues/33339
  test('should render blocking stylesheets for all server-rendered CSS, without duplicate resource hints', async ({ fetch }) => {
    const html = await fetch('/').then(r => r.text())
    expect(html).toContain('Hydrate Never')
    const head = html.match(/<head[^>]*>[\s\S]*?<\/head>/)?.[0] ?? ''
    const stylesheets = [...head.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1]!)
    const css = (await Promise.all(stylesheets.map(href => fetch(href).then(r => r.text())))).join('')
    for (const selector of ['.index-page', '.base-a', '.base-b', '.base-c', '.hydrate-never-component']) {
      expect(css).toContain(selector)
    }
    const hints = [...head.matchAll(/<link[^>]+rel="(?:preload|modulepreload|prefetch)"[^>]+href="([^"]+)"/g)].map(m => m[1]!)
    expect(stylesheets.filter(href => hints.includes(href))).toEqual([])
  })
})

test('renders a previously loaded lazy hydration component on the first frame after remount', async ({ page, goto }) => {
  await goto('/remount')
  await page.locator('[data-testid="plain-remounted-component"]', { hasText: 'This is mounted.' }).first().waitFor()
  await page.locator('[data-testid="hydrated-remounted-component"]', { hasText: 'This is mounted.' }).first().waitFor()

  await page.getByTestId('remount').click()

  await expect(page.getByTestId('plain-count-on-first-frame')).toHaveText('12')
  await expect(page.getByTestId('hydrated-count-on-first-frame')).toHaveText('12')
})

const hydratedText = 'This is mounted.'
const unhydratedText = 'This is not mounted.'

const hydrationTests = {
  'in template': '',
  'with vue macros': '/macro',
  'with pug templates': '/pug',
}

for (const [description, path] of Object.entries(hydrationTests)) {
  test.describe(`delayed hydration components ${description}`, () => {
    test('lazy load delayed hydration comps at the right time', async ({ page, goto, fetch }) => {
      const html = await fetch(`/delayed-hydration${path}`).then(r => r.text())
      expect.soft(html).toContain(unhydratedText)
      expect.soft(html).not.toContain(hydratedText)

      await goto(`/delayed-hydration${path}`)
      const component = (testId: string, text: string) => page.locator(`data-testid=${testId}`, { hasText: text })

      await component('hydrate-on-visible', hydratedText).waitFor()
      expect.soft(await page.getByTestId('hydrate-on-visible-bottom').textContent().then(r => r?.trim())).toBe(unhydratedText)

      await component('hydrate-on-interaction-default', unhydratedText).waitFor()
      await component('hydrate-on-interaction-click', unhydratedText).waitFor()

      await component('hydrate-when-always', hydratedText).waitFor()
      await component('hydrate-when-state', unhydratedText).waitFor()

      await page.getByTestId('hydrate-on-interaction-default').hover()
      await component('hydrate-on-interaction-default', hydratedText).waitFor()

      await page.getByTestId('button-increase-state').click()
      await component('hydrate-when-state', hydratedText).waitFor()

      await page.getByTestId('hydrate-on-visible-bottom').scrollIntoViewIfNeeded()
      await component('hydrate-on-visible-bottom', hydratedText).waitFor()

      await component('hydrate-never', unhydratedText).waitFor()

      // a custom trigger overrides the default interaction events
      await page.getByTestId('hydrate-on-interaction-click').hover()
      await component('hydrate-on-interaction-click', unhydratedText).waitFor({ state: 'visible' })
      await page.getByTestId('hydrate-on-interaction-click').click()
      await component('hydrate-on-interaction-click', hydratedText).waitFor({ state: 'visible' })
      await component('hydrate-on-interaction-click', unhydratedText).waitFor({ state: 'hidden' })

      if (path !== '/macro') {
        await component('event-view-normal-component', hydratedText).waitFor()
        await component('event-view-normal-component', unhydratedText).waitFor({ state: 'hidden' })
      }
    })

    test('handles time-based hydration correctly', async ({ page, goto, fetch }) => {
      const html = await fetch(`/delayed-hydration${path}/time`).then(r => r.text())
      expect(html).toContain(unhydratedText)

      await goto(`/delayed-hydration${path}/time`)
      await page.locator('[data-testid=hydrate-after]', { hasText: hydratedText }).waitFor({ state: 'visible' })

      const hydrationLogs = consoleLogs(page).filter(log => !log.text.includes('[vite]') && !log.text.includes('<Suspense>'))
      expect(hydrationLogs.map(log => log.text)).toEqual([])
    })

    test('emits hydration events and keeps reactivity with models', async ({ page, goto }) => {
      await goto(`/delayed-hydration${path}/model-event`)

      const hydratedEvents = () => consoleLogs(page).filter(log => log.type === 'log' && log.text === 'Component hydrated').length
      const count = page.getByTestId('count')
      const increment = page.getByTestId('increment')

      await expect(count).toHaveText('0')
      expect(hydratedEvents()).toBe(0)

      await increment.dispatchEvent('click')
      await expect(count).toHaveText('1')
      await expect.poll(hydratedEvents).toBeGreaterThan(0)

      for (const value of ['2', '3']) {
        await increment.click()
        await expect(count).toHaveText(value)
      }
    })
  })
}
