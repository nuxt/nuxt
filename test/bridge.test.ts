import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('fixtures:bridge', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/bridge', import.meta.url)),
    server: true
  })

  it('Render hello world', async () => {
    expect(await $fetch('/')).to.contain('Hello Vue 2!')
  })
})
