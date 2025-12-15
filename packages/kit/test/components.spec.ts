import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Component } from '@nuxt/schema'
import { relative } from 'pathe'

import { addComponentExports } from '../src/components.ts'
import { createResolver } from '../src/resolve.ts'

const mockHooks = createHooks()
const mockNuxt = {
  version: '3.0.0',
  options: {
    components: [],
    modulesDir: [],
    extensions: ['.vue', '.js', '.ts'],
  },
  hook: mockHooks.hook.bind(mockHooks),
}

vi.mock('../src/context', async original => ({
  ...await original(),
  tryUseNuxt: () => mockNuxt,
  useNuxt: () => mockNuxt,
}))

describe('addComponentExports', () => {
  it('should add components exports', async () => {
    const resolver = createResolver(import.meta.url)
    addComponentExports({
      filePath: resolver.resolve('./components-fixture/Named'),
      prefix: 'test',
    })
    await mockHooks.callHook('components:dirs', [])
    const components: Component[] = []
    await mockHooks.callHook('components:extend', components)
    for (const c of components) {
      c.filePath = relative(resolver.resolve('./components-fixture'), c.filePath)
      c.shortPath = relative(resolver.resolve('./components-fixture'), c.shortPath)
    }
    expect(components).toMatchInlineSnapshot(`
      [
        {
          "chunkName": "components/test-named-export",
          "export": "NamedExport",
          "filePath": "Named",
          "global": false,
          "kebabName": "test-named-export",
          "meta": {},
          "mode": "all",
          "name": "TestNamedExport",
          "pascalName": "TestNamedExport",
          "prefetch": false,
          "prefix": "test",
          "preload": false,
          "priority": 0,
          "shortPath": "Named",
        },
        {
          "chunkName": "components/test",
          "export": "default",
          "filePath": "Named",
          "global": false,
          "kebabName": "test",
          "meta": {},
          "mode": "all",
          "name": "Test",
          "pascalName": "Test",
          "prefetch": false,
          "prefix": "test",
          "preload": false,
          "priority": 0,
          "shortPath": "Named",
        },
      ]
    `)
  })
})
