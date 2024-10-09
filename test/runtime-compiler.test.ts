import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { isWindows } from 'std-env'
import { expectNoClientErrors } from './utils'

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/runtime-compiler', import.meta.url)),
  dev: process.env.TEST_ENV === 'dev',
  server: true,
  browser: true,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
  nuxtConfig: {
    builder: isWebpack ? 'webpack' : 'vite',
  },
})

describe('test basic config', () => {
  it('expect render page without any error or logs', async () => {
    await expectNoClientErrors('/')
  })

  it('test HelloWorld.vue', async () => {
    const html = await $fetch('/')
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(html).toContain('<div id="hello-world">hello, Helloworld.vue here ! </div>')
    expect(await page.locator('body').innerHTML()).toContain('<div id="hello-world">hello, Helloworld.vue here ! </div>')
    await page.close()
  })

  it('test Name.ts', async () => {
    const html = await $fetch('/')
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(html).toContain('<div id="name">I am the Name.ts component</div>')
    expect(await page.locator('body').innerHTML()).toContain('<div id="name">I am the Name.ts component</div>')

    await page.close()
  })

  it('test ShowTemplate.ts', async () => {
    const html = await $fetch('/')
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(html).toContain('<div id="show-template">Hello my name is : John, i am defined by ShowTemplate.vue and my template is retrieved from the API</div>')
    expect(await page.locator('body').innerHTML()).toContain('<div id="show-template">Hello my name is : John, i am defined by ShowTemplate.vue and my template is retrieved from the API</div>')

    await page.close()
  })

  it('test Interactive component.ts', async () => {
    const html = await $fetch('/')
    const page = await createPage('/')
    await page.waitForFunction(() => window.useNuxtApp?.() && !window.useNuxtApp?.().isHydrating)

    expect(html).toContain('I am defined by Interactive in the setup of App.vue. My full component definition is retrieved from the api')
    expect(await page.locator('#interactive').innerHTML()).toContain('I am defined by Interactive in the setup of App.vue. My full component definition is retrieved from the api')
    const button = page.locator('#inc-interactive-count')
    await button.click()
    const count = page.locator('#interactive-count')
    expect(await count.innerHTML()).toBe('1')

    await page.close()
  })
})
