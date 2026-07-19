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
})
