import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { expectNoErrorsOrWarnings, expectWithPolling, renderPage } from './utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

// TODO: fix HMR on Windows
if (process.env.TEST_ENV !== 'built' && !isWindows) {
  const fixturePath = fileURLToPath(new URL('./fixtures-temp/hmr', import.meta.url))
  await setup({
    rootDir: fixturePath,
    dev: true,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      builder: isWebpack ? 'webpack' : 'vite',
      buildDir: process.env.NITRO_BUILD_DIR,
      nitro: { output: { dir: process.env.NITRO_OUTPUT_DIR } },
    },
  })

  const indexVue = await fsp.readFile(join(fixturePath, 'pages/index.vue'), 'utf8')

  describe('hmr', () => {
    it('should load dev server', async () => {
      await expectWithPolling(() => $fetch<string>('/').then(r => r.includes('Home page')).catch(() => null), true)
    })

    it('should work', async () => {
      const { page, pageErrors, consoleLogs } = await renderPage('/')

      expect(await page.title()).toBe('HMR fixture')
      expect(await page.getByTestId('count').textContent()).toBe('1')

      // reactive
      await page.getByRole('button').click()
      expect(await page.getByTestId('count').textContent()).toBe('2')

      // modify file
      let newContents = indexVue
        .replace('<Title>HMR fixture</Title>', '<Title>HMR fixture HMR</Title>')
        .replace('<h1>Home page</h1>', '<h1>Home page - but not as you knew it</h1>')
      newContents += '<style scoped>\nh1 { color: red }\n</style>'
      await fsp.writeFile(join(fixturePath, 'pages/index.vue'), newContents)

      await expectWithPolling(() => page.title(), 'HMR fixture HMR')

      // content HMR
      const h1 = page.getByRole('heading')
      expect(await h1!.textContent()).toBe('Home page - but not as you knew it')

      // style HMR
      const h1Color = await h1.evaluate(el => window.getComputedStyle(el).getPropertyValue('color'))
      expect(h1Color).toMatchInlineSnapshot('"rgb(255, 0, 0)"')

      // ensure no errors
      expectNoErrorsOrWarnings(consoleLogs)
      expect(pageErrors).toEqual([])

      await page.close()
    })

    it('should detect new routes', async () => {
      const res = await fetch('/some-404')
      expect(res.status).toBe(404)

      // write new page route
      await fsp.writeFile(join(fixturePath, 'pages/some-404.vue'), indexVue)
      await expectWithPolling(() => $fetch<string>('/some-404').then(r => r.includes('Home page')).catch(() => null), true)
    })

    it('should hot reload route rules', async () => {
      await expectWithPolling(() => fetch('/route-rules').then(r => r.headers.get('x-extend')).catch(() => null), 'added in routeRules')

      // write new page route
      const file = await fsp.readFile(join(fixturePath, 'pages/route-rules.vue'), 'utf8')
      await fsp.writeFile(join(fixturePath, 'pages/route-rules.vue'), file.replace('added in routeRules', 'edited in dev'))

      await expectWithPolling(() => fetch('/route-rules').then(r => r.headers.get('x-extend')).catch(() => null), 'edited in dev')
    })

    it('should HMR islands', async () => {
      const { page, pageErrors, consoleLogs } = await renderPage('/server-component')

      const componentPath = join(fixturePath, 'components/islands/HmrComponent.vue')
      const componentContents = await fsp.readFile(componentPath, 'utf8')
      const triggerHmr = (number: string) => fsp.writeFile(componentPath, componentContents.replace('ref(0)', `ref(${number})`))

      // initial state
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '0')

      // first edit
      await triggerHmr('1')
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '1')

      // just in-case
      await triggerHmr('2')
      await expectWithPolling(async () => await page.getByTestId('hmr-id').innerText(), '2')

      // ensure no errors
      expectNoErrorsOrWarnings(consoleLogs)
      expect(pageErrors).toEqual([])

      await page.close()
    })

    it.skipIf(isWebpack)('should HMR page meta', async () => {
      const { page, pageErrors, consoleLogs } = await renderPage('/page-meta')

      const pagePath = join(fixturePath, 'pages/page-meta.vue')
      const pageContents = await fsp.readFile(pagePath, 'utf8')

      expect(JSON.parse(await page.getByTestId('meta').textContent() || '{}')).toStrictEqual({ some: 'stuff' })
      const initialConsoleLogs = structuredClone(consoleLogs)

      await fsp.writeFile(pagePath, pageContents.replace(`some: 'stuff'`, `some: 'other stuff'`))

      await expectWithPolling(async () => await page.getByTestId('meta').textContent() || '{}', JSON.stringify({ some: 'other stuff' }, null, 2))
      expect(consoleLogs).toStrictEqual([
        ...initialConsoleLogs,
        {
          'text': '[vite] hot updated: /pages/page-meta.vue',
          'type': 'debug',
        },
        {
          'text': '[vite] hot updated: /pages/page-meta.vue?macro=true',
          'type': 'debug',
        },
        {
          'text': `[vite] hot updated: /@id/virtual:nuxt:${fixturePath}/.nuxt/routes.mjs`,
          'type': 'debug',
        },
      ])

      // ensure no errors
      expectNoErrorsOrWarnings(consoleLogs)
      expect(pageErrors).toEqual([])

      await page.close()
    })

    it.skipIf(isWebpack)('should HMR routes', async () => {
      const { page, pageErrors, consoleLogs } = await renderPage('/routes')

      await fsp.writeFile(join(fixturePath, 'pages/routes/non-existent.vue'), `<template><div data-testid="contents">A new route!</div></template>`)

      await page.getByRole('link').click()
      await expectWithPolling(() => page.getByTestId('contents').textContent(), 'A new route!')

      for (const log of consoleLogs) {
        if (log.text.includes('No match found for location with path "/routes/non-existent"')) {
          // we expect this warning before the routes are updated
          log.type = 'debug'
        }
      }

      // ensure no errors
      expectNoErrorsOrWarnings(consoleLogs)
      expect(pageErrors).toEqual([])

      await page.close()
    })
  })
} else {
  describe.skip('hmr', () => {})
}
