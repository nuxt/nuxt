import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('fixtures:basic', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    server: true
  })

  describe('server api', () => {
    it('should serialize', async () => {
      expect(await $fetch('/api/hello')).toBe('Hello API')
      expect(await $fetch('/api/hey')).toEqual({
        foo: 'bar',
        baz: 'qux'
      })
    })

    it('should preserve states', async () => {
      expect(await $fetch('/api/counter')).toEqual({ count: 0 })
      expect(await $fetch('/api/counter')).toEqual({ count: 1 })
      expect(await $fetch('/api/counter')).toEqual({ count: 2 })
      expect(await $fetch('/api/counter')).toEqual({ count: 3 })
    })
  })

  describe('pages', () => {
    it('render index', async () => {
      const html = await $fetch('/')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      // should render text
      expect(html).toContain('Hello Nuxt 3!')
      // should render <Head> components
      expect(html).toContain('<title>Basic fixture</title>')
      // should inject runtime config
      expect(html).toContain('RuntimeConfig | testConfig: 123')
      // composables auto import
      expect(html).toContain('Composable | foo: auto imported from ~/components/foo.ts')
      expect(html).toContain('Composable | bar: auto imported from ~/components/useBar.ts')
      // plugins
      expect(html).toContain('Plugin | myPlugin: Injected by my-plugin')
      // should import components
      expect(html).toContain('This is a custom component with a named export.')
    })

    it('render 404', async () => {
      const html = await $fetch('/not-found')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('[...slug].vue')
      expect(html).toContain('404 at not-found')
    })

    it('/nested/[foo]/[bar].vue', async () => {
      const html = await $fetch('/nested/one/two')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('nested/[foo]/[bar].vue')
      expect(html).toContain('foo: one')
      expect(html).toContain('bar: two')
    })

    it('/nested/[foo]/index.vue', async () => {
      const html = await $fetch('/nested/foobar')

      // TODO: should resolved to same entry
      // const html2 = await $fetch('/nested/foobar/index')
      // expect(html).toEqual(html2)

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('nested/[foo]/index.vue')
      expect(html).toContain('foo: foobar')
    })

    it('/nested/[foo]/user-[group].vue', async () => {
      const html = await $fetch('/nested/foobar/user-admin')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('nested/[foo]/user-[group].vue')
      expect(html).toContain('foo: foobar')
      expect(html).toContain('group: admin')
    })
  })

  describe('navigate', () => {
    it('should redirect to index with navigateTo', async () => {
      const html = await $fetch('/navigate-to/')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('Hello Nuxt 3!')
    })
  })

  describe('middlewares', () => {
    it('should redirect to index with global middleware', async () => {
      const html = await $fetch('/redirect/')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('Hello Nuxt 3!')
    })

    it('should inject auth', async () => {
      const html = await $fetch('/auth')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('auth.vue')
      expect(html).toContain('auth: Injected by injectAuth middleware')
    })

    it('should not inject auth', async () => {
      const html = await $fetch('/no-auth')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('no-auth.vue')
      expect(html).toContain('auth: ')
      expect(html).not.toContain('Injected by injectAuth middleware')
    })
  })

  describe('layouts', () => {
    it('should apply custom layout', async () => {
      const html = await $fetch('/with-layout')

      // Snapshot
      // expect(html).toMatchInlineSnapshot()

      expect(html).toContain('with-layout.vue')
      expect(html).toContain('Custom Layout:')
    })
  })
})
