import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
// TODO: Should import from @nuxt/test-utils
import { setup, $fetch } from '../../packages/test-utils/src'

const examplesDir = fileURLToPath(new URL('../../examples', import.meta.url))

await setup({
  rootDir: resolve(examplesDir, 'hello-world'),
  runner: 'vitest',
  server: true
})

describe('examples:hello-world', () => {
  it('Render hello world test', async () => {
    expect(await $fetch('/')).to.contain('Hello Nuxt 3!')
  })
})
