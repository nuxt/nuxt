import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev } from './matrix'

const isMatrixRun = !!process.env.TEST_BUILDER
const skipForMatrix = isMatrixRun && !(
  process.env.TEST_BUILDER === 'vite'
  && process.env.TEST_CONTEXT === 'default'
  && process.env.TEST_MANIFEST === 'manifest-on'
)

if (!skipForMatrix) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/recursive-fetch', import.meta.url)),
    dev: isDev,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(skipForMatrix)('recursive SSR fetch detection', () => {
  it('fails recursive rendered internal fetches with 508 instead of recursing', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('api: pong')
    expect(html).toContain('recursive fetch status: 508')
    expect(html).toContain('Loop detected while rendering')
    expect(html).toContain('/recursive-fetch-target')
  })

  it('redacts query strings from recursive fetch error messages', async () => {
    const secret = 'super-secret-token'
    const response = await fetch(`/recursive-fetch-target?token=${secret}`)
    const text = await response.text()

    expect(response.status).toBe(508)
    expect(text).toContain('Loop detected while rendering')
    expect(text).toContain('/recursive-fetch-target')
    expect(text).not.toContain(secret)
    expect(text).not.toContain('token=')
  })
})
