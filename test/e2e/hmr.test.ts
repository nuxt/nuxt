import type { Router } from 'vue-router'
import { collectConsoleLogs, expect, test } from './test-utils'
import { useTempFixture } from './temp-fixture'

const fixture = useTempFixture('hmr')
const siblingLayer = useTempFixture('hmr-sibling-layer')

test.use({
  nuxt: {
    rootDir: fixture.fixtureDir,
    env: { TEST: '1' },
    nuxtConfig: {
      test: true,
    },
  },
})

test.describe.configure({ mode: 'serial' })

test.afterEach(() => {
  fixture.restore()
  siblingLayer.restore()
})

function poll<T> (getter: () => T | Promise<T>, timeout = 10_000) {
  return expect.poll(getter, { timeout })
}

async function ssrText (fetch: (path: string) => Promise<Response>, path: string, testId: string) {
  const html = await fetch(path).then(r => r.text())
  return html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]+)<`))?.[1]?.trim()
}

test('basic HMR functionality', async ({ page, goto }) => {
  await goto('/')
  await expect(page).toHaveTitle('HMR fixture')
  await expect(page.getByTestId('count')).toHaveText('1')
  await page.locator('button').click()
  await expect(page.getByTestId('count')).toHaveText('2')

  const indexVue = fixture.read('app/pages/index.vue')
  fixture.write('app/pages/index.vue', indexVue
    .replace('<Title>HMR fixture</Title>', '<Title>HMR fixture HMR</Title>')
    .replace('<h1>Home page</h1>', '<h1>Home page - but not as you knew it</h1>')
    + '<style scoped>\nh1 { color: red }\n</style>')

  await expect(page).toHaveTitle('HMR fixture HMR')
  const h1 = page.locator('h1')
  await expect(h1).toHaveText('Home page - but not as you knew it')
  await expect(h1).toHaveCSS('color', 'rgb(255, 0, 0)')

  expect(page).toHaveNoErrorsOrWarnings()
})

test('detecting new routes', async ({ fetch }) => {
  expect((await fetch('/some-404')).status).toBe(404)

  fixture.write('app/pages/some-404.vue', fixture.read('app/pages/index.vue'))

  await poll(() => fetch('/some-404').then(r => r.status)).toBe(200)
})

test('hot reloading route rules', async ({ fetch }) => {
  const header = () => fetch('/route-rules').then(r => r.headers.get('x-extend'))
  await poll(header).toBe('added in routeRules')

  fixture.replace('app/pages/route-rules.vue', 'added in routeRules', 'edited in dev')

  await poll(header, 20_000).toBe('edited in dev')
})

test('SSR fetches pick up an edited server route', async ({ fetch }) => {
  const value = () => ssrText(fetch, '/server-route', 'value')
  await poll(value).toBe('v1')

  fixture.replace('server/api/hmr-value.ts', `'v1'`, `'v2'`)

  await poll(() => fetch('/api/hmr-value').then(r => r.json()).then(r => r.value), 20_000).toBe('v2')
  await poll(value, 20_000).toBe('v2')
})

test('CSS styles persist after nuxt.config restart (#34381)', async ({ fetch }) => {
  const hasStylesheet = () => fetch('/').then(r => r.text()).then(html => /href="[^"]*test\.css[^"]*"/.test(html))
  const afterRestart = { timeout: 30_000, intervals: [1000] }
  await poll(hasStylesheet).toBe(true)

  const config = fixture.read('nuxt.config.ts')
  fixture.write('nuxt.config.ts', config.replace('experimental: {', '// trigger restart\n  experimental: {'))
  await new Promise(resolve => setTimeout(resolve, 1000))
  await expect.poll(hasStylesheet, afterRestart).toBe(true)

  fixture.write('nuxt.config.ts', config)
  await new Promise(resolve => setTimeout(resolve, 1000))
  await expect.poll(() => fetch('/').then(r => r.status), afterRestart).toBe(200)
})

test('HMR for island components', async ({ page, goto }) => {
  await goto('/server-component')
  await expect(page.getByTestId('hmr-id')).toHaveText('0')

  const component = fixture.read('app/components/islands/HmrComponent.vue')
  for (const value of ['1', '2']) {
    fixture.write('app/components/islands/HmrComponent.vue', component.replace('ref(0)', `ref(${value})`))
    await expect(page.getByTestId('hmr-id')).toHaveText(value, { timeout: 10_000 })
  }

  expect(page).toHaveNoErrorsOrWarnings()
})

test('HMR for page meta crossing the static extraction boundary', async ({ page, goto }) => {
  const pageMeta = fixture.read('app/pages/page-meta.vue')
  const writeMeta = (value: string) => fixture.write('app/pages/page-meta.vue', pageMeta.replace(`some: 'stuff'`, value))
  const meta = page.getByTestId('meta')

  await goto('/page-meta')
  await expect(meta).toHaveText(JSON.stringify({ some: 'stuff' }, null, 2))

  // a template literal cannot be serialised, so the route record hands `meta` back to the
  // macro module and the generated route gains an import, which a serialisable value removes again
  writeMeta('some: `other ${\'stuff\'}`')
  await expect(meta).toHaveText(JSON.stringify({ some: 'other stuff' }, null, 2))

  writeMeta(`some: 'final stuff'`)
  await expect(meta).toHaveText(JSON.stringify({ some: 'final stuff' }, null, 2))

  writeMeta(`some: 'stuff'`)
  await expect(meta).toHaveText(JSON.stringify({ some: 'stuff' }, null, 2))

  expect(page).toHaveNoErrorsOrWarnings()
})

for (const block of ['template', 'script']) {
  test(`HMR on page should keep ref state when updating ${block}`, async ({ goto, page }) => {
    await goto('/state-component')

    const button = page.getByTestId('button')
    await expect(button).toHaveText('0')
    await button.click()
    await expect(button).toHaveText('1')

    const logs = collectConsoleLogs(page)
    fixture.replace('app/pages/state-component.vue', `#hmr-${block}`, `#hmr-${block} updated`)
    await poll(() => logs.some(log => log.text.includes('[vite] hot updated'))).toBe(true)

    await expect.soft(button).toHaveText('1')
  })
}

test('HMR for pages using JSX (#30709)', async ({ page, goto }) => {
  await goto('/jsx')
  await expect(page.getByTestId('jsx-content')).toHaveText('jsx: original')

  fixture.replace('app/pages/jsx.vue', 'jsx: original', 'jsx: updated')
  await expect(page.getByTestId('jsx-content')).toHaveText('jsx: updated', { timeout: 10_000 })

  expect(page).toHaveNoErrorsOrWarnings()
})

test('HMR for routes', async ({ page, goto }) => {
  await goto('/routes')

  const logs = collectConsoleLogs(page)
  fixture.write('app/pages/routes/non-existent.vue', `<template><div data-testid="contents">A new route!</div></template>`)
  await poll(() => logs.some(log => log.text.includes('[vite] hot updated')), 20_000).toBe(true)

  await page.locator('a[href="/routes/non-existent"]').click()
  await expect(page.getByTestId('contents')).toHaveText('A new route!')

  expect(logs.filter(log => (log.type === 'warning' || log.type === 'error') && !log.text.includes('No match found for location with path "/routes/non-existent"'))).toStrictEqual([])
})

test('should support renaming files to same import name', async ({ page, goto }) => {
  await goto('/rename-component')
  await expect(page.getByTestId('example')).toHaveText('test.vue')

  fixture.remove('app/components/example/test.vue')
  fixture.write('app/components/example/example-test.vue', `<template><div data-testid="example">example-test.vue</div></template>`)

  await expect.soft(page.getByTestId('example')).toHaveText('example-test.vue')
  await page.reload()
  await expect(page.getByTestId('example')).toHaveText('example-test.vue')
})

test('should allow hmr with useAsyncData (#32177)', async ({ page, goto }) => {
  await goto('/issues/32177')

  const logs = collectConsoleLogs(page)
  fixture.replace('app/pages/issues/32177.vue', '// #HMR_REPLACE', 'console.log("hmr")')
  await poll(() => logs.some(log => log.text === 'hmr')).toBe(true)
  await expect(page.getByTestId('contents')).toHaveText('Element 1, Element 2')
})

test('HMR with top-level await', async ({ page, goto }) => {
  await goto('/top-level-await')
  await expect(page.getByTestId('content')).toHaveText('loaded')

  fixture.replace('app/pages/top-level-await.vue', `console.log('page loaded')`, `// console.log('page loaded')`)

  await page.waitForTimeout(1000)
  await expect(page.getByTestId('content')).toHaveText('loaded')
  expect(page).toHaveNoErrorsOrWarnings()
})

test('custom routes added via router.addRoute() should survive HMR (#32027)', async ({ page, goto }) => {
  const hasRoute = (name: string) => page.evaluate(name => (window.useNuxtApp!().$router as Router).hasRoute(name), name)

  await goto('/custom-route')
  await expect(page.getByTestId('custom-route')).toHaveText('Custom route added via plugin')
  expect(await hasRoute('custom-route')).toBe(true)

  const logs = collectConsoleLogs(page)
  fixture.write('app/pages/hmr-trigger.vue', `<template><div data-testid="hmr-trigger">HMR trigger page</div></template>`)
  await poll(() => page.evaluate(() => (window.useNuxtApp!().$router as Router).getRoutes().some(r => r.path === '/hmr-trigger')), 20_000).toBe(true)

  expect(await hasRoute('custom-route')).toBe(true)
  expect(logs.filter(log => (log.type === 'warning' || log.type === 'error') && !log.text.includes('No match found for location with path "/hmr-trigger"'))).toStrictEqual([])
})

// https://github.com/nuxt/nuxt/issues/34763 / https://github.com/nuxt/nuxt/issues/30169
test('SSR re-evaluates components in a sibling local layer', async ({ fetch }) => {
  const marker = () => ssrText(fetch, '/sibling-layer', 'sibling-marker')
  await poll(marker).toBe('v1')

  siblingLayer.replace('app/components/SiblingLayerMarker.vue', `'v1'`, `'v2'`)

  await poll(marker, 30_000).toBe('v2')
})

// https://github.com/nuxt/nuxt/issues/33468
test('SSR picks up a changed export style in an auto-imported file', async ({ fetch }) => {
  const key = () => ssrText(fetch, '/auto-import-key', 'key')
  await poll(key).toBe('default-export')

  // the import injected into the page has to change from `default` to `useHmrKey`
  fixture.write('app/composables/useHmrKey.ts', `export function useHmrKey () {\n  return 'named-export'\n}\n`)

  await poll(key, 30_000).toBe('named-export')
})

// https://github.com/nuxt/nuxt/issues/30169
test('SSR re-evaluates virtual modules invalidated via handleHotUpdate', async ({ fetch }) => {
  const counter = () => ssrText(fetch, '/virtual-module', 'counter').then(Number)
  await poll(counter).not.toBeNaN()
  const before = await counter()

  fixture.replace('app/pages/virtual-module.vue', '<!-- HMR_TRIGGER -->', '<!-- HMR_TRIGGER edited -->')

  await poll(counter).toBeGreaterThan(before)
})
