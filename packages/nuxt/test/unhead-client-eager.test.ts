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
    ['non-injecting entries', `import { createHead } from '@unhead/vue/server'`],
    ['client constructors', `import { createHead, renderDOMHead } from '@unhead/vue/client'`],
    ['other strings', `const message = 'import from @unhead/vue'`],
    ['entry names used as values', `export const packageName = '@unhead/vue'`],
    ['pure helper re-exports', `export { defineLink, defineScript as script } from '@unhead/vue'`],
    ['type-only re-exports', `export type { VueHeadClient } from '@unhead/vue'`],
  ])('should not transform %s', async (_, code) => {
    expect(await transform(code)).toBeUndefined()
  })

  it('should not transform type-only module references', async () => {
    const code = `declare module '@unhead/vue' { interface Extra {} }\ntype Unhead = typeof import('@unhead/vue')`
    expect(await transform(code, '/project/plugins/head.ts')).toBeUndefined()
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
    ['template literal dynamic imports', 'const { useHead } = await import(`@unhead/vue`)'],
    ['require calls', `const { useHead } = require('@unhead/vue')`],
    ['bundler require calls', `const { useHead } = __require("@unhead/vue")`],
    ['the client mixin', `import { VueHeadMixin } from '@unhead/vue/client'`],
  ])('should import the eager client head for %s', async (_, code) => {
    expect(await transform(code)).toMatch(/^import "\/nuxt\/head\/runtime\/client-head-eager";\n/)
  })

  it('should import the eager client head for TypeScript import-equals declarations', async () => {
    expect(await transform(`import unhead = require('@unhead/vue')`, '/project/plugins/head.ts')).toMatch(/^import "\/nuxt\/head\/runtime\/client-head-eager";\n/)
  })

  it('should import the eager client head for composables imported in virtual modules', async () => {
    expect(await transform(`import { useHead } from '@unhead/vue'`, 'virtual:nuxt:/project/.nuxt/my-module-plugin.mjs')).toMatch(/^import "\/nuxt\/head\/runtime\/client-head-eager";\n/)
    expect(await transform(`import { defineLink } from '@unhead/vue'`, 'virtual:nuxt:/project/.nuxt/my-module-plugin.mjs')).toBeUndefined()
  })
})
