import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

if (runsOncePerEnvInMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/build-assets-dir-collision', import.meta.url)),
    dev: isDev,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix)('buildAssetsDir collision with source dir (#24035)', () => {
  it('renders without crashing on SSR', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('data-testid="hello"')
    expect(html).toContain('hello world')
  })

  it.runIf(isDev)('serves a plain 404 for the build assets dir root when `buildAssetsDir` has no slashes', async () => {
    const res = await fetch('/abc/')
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not Found')
  })
})
