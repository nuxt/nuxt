import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

const examplesDir = fileURLToPath(new URL('../../examples', import.meta.url))

await setup({
  rootDir: resolve(examplesDir, 'hello-world'),
  server: true
})

describe('examples:hello-world', () => {
  it('Render hello world test', async () => {
    expect(await $fetch('/')).to.contain('Hello Nuxt 3!')
  })
})
