import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { join } from 'pathe'
// eslint-disable-next-line import/order
import { setup, $fetch } from '@nuxt/test-utils'

import { expectWithPolling, renderPage } from './utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack'

// TODO: fix HMR on Windows
if (process.env.TEST_ENV !== 'built' && !isWindows) {
  const fixturePath = fileURLToPath(new URL('./fixtures-temp/basic', import.meta.url))
  await setup({
    rootDir: fixturePath,
    dev: true,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 240 : 120) * 1000,
    nuxtConfig: {
      builder: isWebpack ? 'webpack' : 'vite',
      buildDir: process.env.NITRO_BUILD_DIR,
      nitro: { output: { dir: process.env.NITRO_OUTPUT_DIR } }
    }
  })

  describe('hmr', () => {
    it('should work', async () => {
      const { page, pageErrors, consoleLogs } = await renderPage('/')

      expect(await page.title()).toBe('Basic fixture')
      expect((await page.$('.sugar-counter').then(r => r!.textContent()))!.trim())
        .toEqual('Sugar Counter 12 x 2 = 24  Inc')

      // reactive
      await page.$('.sugar-counter button').then(r => r!.click())
      expect((await page.$('.sugar-counter').then(r => r!.textContent()))!.trim())
        .toEqual('Sugar Counter 13 x 2 = 26  Inc')

      // modify file
      let indexVue = await fsp.readFile(join(fixturePath, 'pages/index.vue'), 'utf8')
      indexVue = indexVue
        .replace('<Title>Basic fixture</Title>', '<Title>Basic fixture HMR</Title>')
        .replace('<h1>Hello Nuxt 3!</h1>', '<h1>Hello Nuxt 3! HMR</h1>')
      indexVue += '<style scoped>\nh1 { color: red }\n</style>'
      await fsp.writeFile(join(fixturePath, 'pages/index.vue'), indexVue)

      await expectWithPolling(
        () => page.title(),
        'Basic fixture HMR'
      )

      // content HMR
      const h1 = await page.$('h1')
      expect(await h1!.textContent()).toBe('Hello Nuxt 3! HMR')

      // style HMR
      const h1Color = await h1!.evaluate(el => window.getComputedStyle(el).getPropertyValue('color'))
      expect(h1Color).toMatchInlineSnapshot('"rgb(255, 0, 0)"')

      // ensure no errors
      const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
      const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warn')
      expect(pageErrors).toEqual([])
      expect(consoleLogErrors).toEqual([])
      expect(consoleLogWarnings).toEqual([])
    }, 60_000)

    it('should detect new routes', async () => {
      const html = await $fetch('/some-404')
      expect(html).toContain('catchall at some-404')

      // write new page route
      const indexVue = await fsp.readFile(join(fixturePath, 'pages/index.vue'), 'utf8')
      await fsp.writeFile(join(fixturePath, 'pages/some-404.vue'), indexVue)

      await expectWithPolling(
        () => $fetch('/some-404').then(r => r.includes('Hello Nuxt 3')),
        true
      )
    })
  })
} else {
  describe.skip('hmr', () => {})
}
