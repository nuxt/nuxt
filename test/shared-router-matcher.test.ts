import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

// the matcher is only shared in production builds
const shouldRun = runsOncePerEnvInMatrix && !isDev

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/shared-router-matcher', import.meta.url)),
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('experimental.sharedRouterMatcher', () => {
  it('reuses the route records between requests', async () => {
    await $fetch<string>('/')
    const html = await $fetch<string>('/')
    expect(html).toMatch(/<p id="shared">\s*true\s*<\/p>/)
  })

  it('does not let a request change the shared routes', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('`router.addRoute()` cannot be used on the server with `experimental.sharedRouterMatcher`.')
    expect(await $fetch<string>('/added').catch((error: { statusCode?: number }) => error.statusCode)).toBe(404)
  })
})
