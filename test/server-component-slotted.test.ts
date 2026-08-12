import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { setup } from '@nuxt/test-utils/e2e'
import { isDev, runsOncePerEnvInMatrix } from './matrix'
import { renderPage } from './utils'

if (runsOncePerEnvInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/server-component-slotted', import.meta.url)),
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix)('server component slotted styles', () => {
  // https://github.com/nuxt/nuxt/issues/31510
  it('applies scoped styles to server component slots', async () => {
    const { page } = await renderPage('/')

    try {
      const slotted = page.locator('#slotted-style-in-server')
      expect(await slotted.count()).toBe(1)

      const slottedStyles = await slotted.evaluate((element) => {
        const scopeIds = element.getAttributeNames().filter(name => name.startsWith('data-v-'))
        return {
          backgroundColor: getComputedStyle(element).backgroundColor,
          color: getComputedStyle(element).color,
          hasParentScopeId: scopeIds.some(name => !name.endsWith('-s')),
          hasSlottedScopeId: scopeIds.some(name => name.endsWith('-s')),
        }
      })
      expect(slottedStyles).toEqual({
        backgroundColor: 'rgb(4, 5, 6)',
        color: 'rgb(1, 2, 3)',
        hasParentScopeId: true,
        hasSlottedScopeId: true,
      })
    } finally {
      await page.close()
    }
  })
})
