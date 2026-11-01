import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

const shouldRun = runsOncePerEnvInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/static-routes', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('experimental.staticRoutes', () => {
  it('renders pages and links as usual', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('static-routes-index')
    expect(html).toContain('<a href="/users/42"')
    expect(await $fetch<string>('/users/42')).toContain('static-routes-user-42')
  })

  it('refuses to change the route table at runtime', async () => {
    const html = await $fetch<string>('/add-route')
    expect(html).toMatch(/e2014|staticRoutes/i)
    expect(html).not.toContain('>added<')
  })

  it('keeps in-component guards off the shared route records', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await $fetch<string>('/guards')).toContain('shared-record-guards:0')
    }
  })

  it.skipIf(isDev)('responds with an early 404 for paths no page can match', async () => {
    const response = await fetch('/no/such/page')
    expect(response.status).toBe(404)
  })
})
