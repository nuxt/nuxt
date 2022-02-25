import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('fixtures:basic', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    server: true
  })

  it('server api', async () => {
    expect(await $fetch('/api/hello')).toBe('Hello API')
    expect(await $fetch('/api/hey')).toEqual({
      foo: 'bar',
      baz: 'qux'
    })
  })

  it('render index.html', async () => {
    const index = await $fetch('/')

    // Snapshot
    // expect(index).toMatchInlineSnapshot()

    // should render text
    expect(index).toContain('Hello Nuxt 3!')
    // should render <Head> components
    expect(index).toContain('<title>Basic fixture</title>')
    // should inject runtime config
    expect(index).toContain('RuntimeConfig: 123')
    // should import components
    expect(index).toContain('This is a custom component with a named export.')
    // composables auto import
    expect(index).toContain('auto imported from ~/components/foo.ts')
    expect(index).toContain('auto imported from ~/components/useBar.ts')
  })
})
