import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { setup } from '@nuxt/test-utils/e2e'

import { isBuilt, isWebpack, runsOncePerBuilderInMatrix } from './matrix'
import { renderPage } from './utils'

const shouldRun = runsOncePerBuilderInMatrix && isBuilt && !isWebpack

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/fetch-global-always', import.meta.url)),
    dev: false,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('client `$fetch` global with `experimental.globalFetch`', () => {
  it('installs the global on a page that never reads it', async () => {
    const { page, pageErrors } = await renderPage('/plain')
    expect(await page.evaluate(() => (window as unknown as { $fetch: (url: string) => Promise<string> }).$fetch('/api/hello'))).toBe('hello')
    expect(pageErrors).toEqual([])
    await page.close()
  })
})
