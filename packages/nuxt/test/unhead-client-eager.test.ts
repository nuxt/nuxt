// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { UnheadClientEagerPlugin } from '../src/head/plugins/unhead-client-eager.ts'
import { matchesIdFilter } from './utils.ts'

describe('UnheadClientEagerPlugin', () => {
  const plugin = UnheadClientEagerPlugin({ eagerEntry: '/nuxt/head/runtime/client-head-eager' }).raw({}, {} as any) as any

  async function transform (code: string, id = '/project/node_modules/some-lib/index.js'): Promise<string | undefined> {
    return (await plugin.transform.handler(code, id))?.code
  }

  it.each([
    ['/project/node_modules/some-lib/index.js', true],
    ['/project/components/MyComponent.vue', true],
    ['virtual:nuxt:/project/.nuxt/my-module-plugin.mjs', true],
    ['/project/node_modules/@unhead/vue/dist/scripts.mjs', false],
    ['/project/node_modules/nuxt/dist/head/runtime/composables.js', false],
  ])('should match %s: %s', (id, included) => {
    expect(matchesIdFilter(plugin.transform.filter.id, id)).toBe(included)
  })

  it.each([
    ['Nuxt-rewritten composables', `import { useHead, useSeoMeta } from '@unhead/vue'`],
    ['pure helpers', `import { defineLink, defineScript } from '@unhead/vue'`],
    ['type-only imports', `import type { UseScriptInput } from '@unhead/vue/scripts'`],
    ['type-only specifiers', `import { type VueHeadClient } from '@unhead/vue'`],
    ['non-injecting entries', `import { createHead } from '@unhead/vue/client'`],
    ['pure helper re-exports', `export { defineLink, defineScript as script } from '@unhead/vue'`],
    ['type-only re-exports', `export type { VueHeadClient } from '@unhead/vue'`],
  ])('should not transform %s', async (_, code) => {
    expect(await transform(code)).toBeUndefined()
  })

  it.each([
    ['useServerHead', `import { useServerHead } from '@unhead/vue'`],
    ['useScript', `import { useScript } from '@unhead/vue/scripts'`],
    ['components', `import { Head } from '@unhead/vue/components'`],
    ['headSymbol', `import { headSymbol } from '@unhead/vue'`],
    ['namespace imports', `import * as unhead from '@unhead/vue'`],
    ['re-exports', `export { useServerHead } from '@unhead/vue'`],
    ['re-exported composables', `export { defineLink, useHead } from '@unhead/vue'`],
    ['star re-exports', `export * from '@unhead/vue'`],
    ['dynamic imports', `const { useScript } = await import('@unhead/vue/scripts')`],
  ])('should import the eager client head for %s', async (_, code) => {
    expect(await transform(code)).toMatch(/^import "\/nuxt\/head\/runtime\/client-head-eager";\n/)
  })
})
