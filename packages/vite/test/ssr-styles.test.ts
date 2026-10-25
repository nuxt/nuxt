import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { SSRStylesPlugin } from '../src/plugins/ssr-styles.ts'
import { withInlineQuery } from '../src/utils/inline-styles.ts'

const COMPONENT = '/app/components/Foo.vue'
const STYLE = `${COMPONENT}?vue&type=style&index=0&scoped=7d7f4a5d&lang.css`

function createNuxt () {
  return {
    options: {
      dev: false,
      srcDir: '/app',
      buildDir: '/app/.nuxt',
      css: [],
      features: { inlineStyles: (id?: string) => !!id && id.includes('.vue') },
      experimental: {},
      _noScriptsPageSources: [],
    },
    apps: { default: { components: [], pages: [] } },
    hook: () => {},
  } as unknown as Nuxt
}

function setup (environmentName: 'client' | 'ssr') {
  const plugin = SSRStylesPlugin(createNuxt())!
  ;(plugin.configResolved as any)({ environments: {}, build: { rolldownOptions: { input: '/app/entry.ts' } } })
  const env = (plugin.applyToEnvironment as any)({ name: environmentName })
  const ctx = {
    environment: { name: environmentName },
    resolve: (id: string) => Promise.resolve({ id }),
  }
  return {
    resolveId: (id: string, importer = COMPONENT) => env.resolveId.handler.call(ctx, id, importer, {}),
    load: (id: string) => env.load.filter.id.test(id) ? env.load.handler.call(ctx, id) : undefined,
  }
}

describe('ssr-styles plugin', () => {
  it('gives plain style blocks an empty module in the server build', async () => {
    const { resolveId, load } = setup('ssr')
    const resolved = await resolveId(STYLE)
    expect(resolved).toEqual({ id: expect.stringMatching(/^\0/), moduleSideEffects: false })
    expect(load(resolved.id)).toBe('export {}')
  })

  it.each([
    ['inlined styles', withInlineQuery(STYLE)],
    ['custom element styles', `${COMPONENT}?vue&type=style&index=0&inline&lang.css`],
    ['CSS modules', `${COMPONENT}?vue&type=style&index=0&module&lang.module.css`],
    ['named CSS modules', `${COMPONENT}?vue&type=style&index=0&module=classes&lang.module.css`],
  ])('compiles %s in the server build', async (_, id) => {
    const { resolveId } = setup('ssr')
    expect(await resolveId(id)).toEqual({ id, moduleSideEffects: false })
  })

  it('compiles plain style blocks in the client build', async () => {
    const { resolveId } = setup('client')
    expect(await resolveId(STYLE)).toEqual({ id: STYLE, moduleSideEffects: false })
  })
})
