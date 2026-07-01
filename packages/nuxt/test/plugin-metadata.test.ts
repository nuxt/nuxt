import { describe, expect, it, vi } from 'vitest'

import { RemovePluginMetadataPlugin, extractMetadata } from '../src/core/plugins/plugin-metadata.ts'
import { checkForCircularDependencies, hasIslandOptOutPlugins, hasParallelPlugins, hasPluginDependencies, hasPluginHooks } from '../src/core/app.ts'

describe('plugin-metadata', () => {
  const properties = Object.entries({
    name: 'test',
    enforce: 'post',
    hooks: { 'app:mounted': () => {} },
    setup: () => { return { provide: { jsx: '[JSX]' } } },
    order: 1,
  })
  it.each(properties)('should extract metadata from object-syntax plugins', (k, value) => {
    const obj = [...properties.filter(([key]) => key !== k), [k, value]]

    const meta = extractMetadata([
      'export default defineNuxtPlugin({',
      ...obj.map(([key, value]) => `${key}: ${typeof value === 'function' ? value.toString().replace('"[JSX]"', '() => <span>JSX</span>') : JSON.stringify(value)},`),
      '})',
    ].join('\n'), 'tsx')

    expect(meta).toEqual({
      'name': 'test',
      'order': 1,
      'hasHooks': true,
    })
  })

  it('should extract `parallel: true` from object-syntax plugins', () => {
    const meta = extractMetadata([
      'export default defineNuxtPlugin({',
      '  name: \'test\',',
      '  parallel: true,',
      '  setup: () => {},',
      '})',
    ].join('\n'))

    expect(meta).toEqual({
      'name': 'test',
      'order': 0,
      'parallel': true,
    })
  })

  it('should flag `env` presence on object-syntax plugins', () => {
    const meta = extractMetadata([
      'export default defineNuxtPlugin({',
      '  name: \'test\',',
      '  env: { islands: false },',
      '  setup: () => {},',
      '})',
    ].join('\n'))

    expect(meta).toEqual({
      'name': 'test',
      'order': 0,
      'hasEnv': true,
    })
  })

  const transformPlugin: any = RemovePluginMetadataPlugin({
    options: { sourcemap: { client: true } },
    apps: { default: { plugins: [{ src: 'my-plugin.mjs', order: 10 }] } },
  } as any).raw({}, {} as any)

  it('should overwrite invalid plugins', () => {
    const invalidPlugins = [
      'export const plugin = {}',
    ]
    for (const plugin of invalidPlugins) {
      expect(transformPlugin.transform(plugin, 'my-plugin.mjs').code).toBe('export default () => {}')
    }
  })

  it('should remove order/name properties from object-syntax plugins', () => {
    const plugin = `
      export default defineNuxtPlugin({
        name: 'test',
        enforce: 'post',
        setup: () => {},
      }, { order: 10, name: test })
    `
    expect(transformPlugin.transform(plugin, 'my-plugin.mjs').code).toMatchInlineSnapshot(`
      "
            export default defineNuxtPlugin({
              setup: () => {},
            }, { })
          "
    `)
  })
})

describe('plugin sanity checking', () => {
  it('non-existent depends are warned', () => {
    vi.spyOn(console, 'error')
    checkForCircularDependencies([
      {
        name: 'A',
        src: '',
      },
      {
        name: 'B',
        dependsOn: ['D'],
        src: '',
      },
      {
        name: 'C',
        src: '',
      },
    ])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Plugin `B` depends on `D` but they are not registered.'))
    vi.restoreAllMocks()
  })

  it('circular dependencies are warned', () => {
    vi.spyOn(console, 'error')
    checkForCircularDependencies([
      {
        name: 'A',
        dependsOn: ['B'],
        src: '',
      },
      {
        name: 'B',
        dependsOn: ['C'],
        src: '',
      },
      {
        name: 'C',
        dependsOn: ['A'],
        src: '',
      },
    ])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: A -> B -> C -> A'))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: B -> C -> A -> B'))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: C -> A -> B -> C'))
    vi.restoreAllMocks()
  })
})

describe('plugin capability probes', () => {
  const probes = [hasPluginDependencies, hasParallelPlugins, hasPluginHooks, hasIslandOptOutPlugins]

  it('flag unparseable plugin shapes so capability probes fall back to the full runtime resolver', () => {
    const shapes = {
      'imported identifier as plugin arg': 'import myPlugin from \'./external\'\nexport default defineNuxtPlugin(myPlugin)',
      'factory call as plugin arg': 'import { make } from \'./factory\'\nexport default defineNuxtPlugin(make())',
      'member access as plugin arg': 'import * as ext from \'./external\'\nexport default defineNuxtPlugin(ext.plugin)',
    }

    for (const [label, code] of Object.entries(shapes)) {
      const meta = extractMetadata(code)
      expect(meta._metaUnknown, label).toBe(true)
      for (const probe of probes) {
        expect(probe([meta as never]), `${label} (${probe.name})`).toBe(true)
      }
    }
  })

  it('do not flag function-syntax plugins as unknown (they cannot carry capability metadata)', () => {
    const shapes = {
      'arrow function': 'export default defineNuxtPlugin(() => {})',
      'anonymous function': 'export default defineNuxtPlugin(function (nuxt) {})',
    }

    for (const [label, code] of Object.entries(shapes)) {
      const meta = extractMetadata(code)
      expect(meta._metaUnknown ?? false, label).toBe(false)
      for (const probe of probes) {
        expect(probe([meta as never]), `${label} (${probe.name})`).toBe(false)
      }
    }
  })

  it('treat plugins that throw during static parse as unknown so runtime keeps full paths', () => {
    expect(() => extractMetadata('export default defineNuxtPlugin({ dependsOn: [someName] })')).toThrow()

    const fallback = { _metaUnknown: true as const }
    for (const probe of probes) {
      expect(probe([fallback]), probe.name).toBe(true)
    }
  })
})
