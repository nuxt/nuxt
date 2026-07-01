import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev } from './matrix'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  dev: isDev,
  server: true,
  browser: false,
  setupTimeout: 120 * 1000,
  nuxtConfig: {
    pages: false,
  },
})

describe('app router without pages', () => {
  it('returns 500 when there is an infinite middleware redirect', async () => {
    const { status } = await fetch('/catchall/redirect-infinite', { redirect: 'manual' })
    expect(status).toEqual(500)
  })
})
