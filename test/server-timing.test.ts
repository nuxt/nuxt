import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/server-timing', import.meta.url)),
  server: true,
})

describe('server timing', () => {
  it('should include server-timing headers for plugins and middleware', async () => {
    const res = await fetch('/')
    const serverTiming = res.headers.get('server-timing')

    expect(serverTiming).toContain('plugin:test-plugin;dur=')
    expect(serverTiming).toContain('middleware:test-global;dur=')
  })
})
