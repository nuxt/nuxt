import { Parser } from 'acorn'
import { describe, expect, it } from 'vitest'

import { componentsIslandsTemplate } from '../src/components/templates.ts'
import type { Component } from '@nuxt/schema'
import type { Nuxt, NuxtApp } from 'nuxt/schema'

function makeNuxt (): Nuxt {
  return {
    options: {
      rootDir: '/root',
      experimental: { componentIslands: true },
    },
  } as unknown as Nuxt
}

function makeComponent (overrides: Partial<Component>): Component {
  return {
    filePath: '/root/components/Some.island.vue',
    pascalName: 'Some',
    kebabName: 'some',
    chunkName: 'components/some-server',
    export: 'default',
    shortPath: 'components/Some.island.vue',
    island: true,
    mode: 'server',
    prefetch: false,
    preload: false,
    priority: 1,
    ...overrides,
  } as Component
}

describe('componentsIslandsTemplate', () => {
  it('emits parseable module output for island component names starting with a digit', async () => {
    const app = {
      components: [makeComponent({
        filePath: '/root/components/1thing.island.vue',
        pascalName: '1thing',
        kebabName: '1thing',
        chunkName: 'components/1thing-server',
        shortPath: 'components/1thing.island.vue',
      })],
      pages: [],
    } as unknown as NuxtApp

    const contents = await componentsIslandsTemplate.getContents!({ app, nuxt: makeNuxt(), options: {} })

    expect(contents).toContain('"1thing": defineAsyncComponent(')
    expect(() => Parser.parse(contents, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow()
  })

  it('does not import vue-router when there are no server page islands', async () => {
    const app = {
      components: [makeComponent({})],
      pages: [],
    } as unknown as NuxtApp

    const contents = await componentsIslandsTemplate.getContents!({ app, nuxt: makeNuxt(), options: {} })

    expect(contents).not.toContain('vue-router')
    expect(contents).toContain('export const providePageIslandDepth')
    expect(() => Parser.parse(contents, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow()
  })

  it('imports vue-router only when server page islands exist', async () => {
    const app = {
      components: [makeComponent({})],
      pages: [{ name: 'home', mode: 'server', file: '/root/pages/index.server.vue', path: '/' }],
    } as unknown as NuxtApp

    const contents = await componentsIslandsTemplate.getContents!({ app, nuxt: makeNuxt(), options: {} })

    expect(contents).toContain('import { viewDepthKey } from \'vue-router\'')
    expect(contents).toContain('export const providePageIslandDepth')
    expect(() => Parser.parse(contents, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow()
  })
})
