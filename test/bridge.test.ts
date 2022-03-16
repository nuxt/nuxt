import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('fixtures:bridge', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/bridge', import.meta.url)),
    server: true
  })

  describe('pages', () => {
    it('render hello world', async () => {
      expect(await $fetch('/')).to.contain('Hello Vue 2!')
    })
  })

  describe('navigate', () => {
    it('should redirect to index with navigateTo', async () => {
      const html = await $fetch('/navigate-to/')
      expect(html).toContain('Hello Vue 2!')
    })
  })
})
