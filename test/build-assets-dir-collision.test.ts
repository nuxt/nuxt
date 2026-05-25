import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { builder, isDev } from './matrix'

if (builder === 'vite') {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/build-assets-dir-collision', import.meta.url)),
    dev: isDev,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(builder !== 'vite')('buildAssetsDir collision with source dir (#24035)', () => {
  it('renders without crashing on SSR', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('data-testid="hello"')
    expect(html).toContain('hello world')
  })
})
