import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('fixtures:basic', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    server: true
  })
  it('Render hello world', async () => {
    expect(await $fetch('/')).to.contain('Hello Nuxt 3!')
  })
})
