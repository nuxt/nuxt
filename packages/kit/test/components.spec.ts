import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Component } from '@nuxt/schema'
import { relative } from 'pathe'

import { addComponent, addComponentExports } from '../src/components.ts'
import { createResolver } from '../src/resolve.ts'

const mockNuxt = {
  options: {
    components: [],
    modulesDir: [],
    extensions: ['.vue', '.js', '.ts'],
  },
  hook: undefined as unknown,
}

vi.mock('../src/context', async original => ({
  ...await original(),
  tryUseNuxt: () => mockNuxt,
  useNuxt: () => mockNuxt,
}))

describe('addComponentExports', () => {
  let mockHooks: ReturnType<typeof createHooks>
  beforeEach(() => {
    mockHooks = createHooks()
    mockNuxt.hook = mockHooks.hook.bind(mockHooks)
  })

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
  it('should add components other than an existing component', async () => {
    const resolver = createResolver(import.meta.url)
    addComponent({
      filePath: resolver.resolve('./components-fixture/Named'),
      name: 'TestNamedExport',
      export: 'NamedExport',
      priority: 1,
    })
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
    expect(components.length).eq(2)
    expect(components[1]).toMatchInlineSnapshot(`
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
        }
    `)
  })
})
