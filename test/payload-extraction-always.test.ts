import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { isDev } from './matrix'
import { parsePayload } from './utils'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/payload-extraction-always', import.meta.url)),
  dev: isDev,
  server: true,
  setupTimeout: 120 * 1000,
})

describe.skipIf(isDev)('payloadExtraction always', () => {
  it('renders payloads for non-prerendered server routes', async () => {
    const payload = await $fetch<string>('/users/_payload.json', { responseType: 'text' })
    const data = parsePayload(payload)

    expect(data.data.users).toEqual([
      {
        name: 'Ada',
      },
    ])
  })
})
