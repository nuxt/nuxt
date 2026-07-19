import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { runsOnceInMatrix } from './matrix'
import { expectNoErrorsOrWarnings, renderPage } from './utils'

if (runsOnceInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/unhead-major-resolution', import.meta.url)),
    dev: false,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOnceInMatrix)('Unhead major version resolution', () => {
  it('uses Nuxt\'s Unhead version when the application provides v2', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('<title>Nuxt-owned Unhead</title>')
    expect(html).toContain('<style id="nuxt-owned-unhead">:root { --nuxt-owned-unhead: true; }</style>')
  })

  it('hydrates using Nuxt\'s Unhead version', async () => {
    const { page, pageErrors, consoleLogs } = await renderPage('/')

    expect(await page.title()).toBe('Nuxt-owned Unhead hydrated')
    expect(pageErrors).toEqual([])
    expectNoErrorsOrWarnings(consoleLogs)

    await page.close()
  })
})
