import { describe, expect, it } from 'vitest'
import { $fetch, isDev } from '@nuxt/test-utils'

describe('example', () => {
  it('Renders Hello Nuxt', async () => {
    expect(await $fetch('/')).toMatch('Hello Nuxt!')
  })

  if (isDev()) {
    it('[dev] ensure vite client script is added', async () => {
      expect(await $fetch('/')).toMatch('/_nuxt/@vite/client"')
    })
  }
})
