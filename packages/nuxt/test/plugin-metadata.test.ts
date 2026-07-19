import { describe, expect, it, vi } from 'vitest'

import { RemovePluginMetadataPlugin, extractMetadata, setPluginDependenciesForMode } from '../src/core/plugins/plugin-metadata.ts'
import { checkForCircularDependencies, filterPluginDependencies, hasIslandOptOutPlugins, hasParallelPlugins, hasPluginDependencies, hasPluginHooks } from '../src/core/app.ts'

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

  const nuxt = {
    options: { sourcemap: { client: true } },
    apps: { default: { plugins: [{ src: 'my-plugin.mjs', order: 10 }] } },
  } as any
  const transformPlugin: any = RemovePluginMetadataPlugin(nuxt, 'client').raw({}, {} as any)

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

  it('should filter plugin dependencies for the build mode', () => {
    const filterNuxt = {
      options: { sourcemap: { client: true } },
      apps: { default: { plugins: [{ src: 'my-plugin.mjs' }] } },
    } as any
    setPluginDependenciesForMode(filterNuxt, 'client', [{ src: 'my-plugin.mjs', dependsOn: ['client-plugin'] }])
    setPluginDependenciesForMode(filterNuxt, 'server', [{ src: 'my-plugin.mjs', dependsOn: ['server-plugin'] }])
    const plugin = `
      export default defineNuxtPlugin({
        name: 'test',
        dependsOn: ['client-plugin', 'server-plugin'],
        setup: () => {},
      })
    `
    const transform = (mode: 'client' | 'server') => (RemovePluginMetadataPlugin(filterNuxt, mode).raw({}, {} as any) as any).transform(plugin, 'my-plugin.mjs').code
    expect({
      client: transform('client'),
      server: transform('server'),
    }).toMatchInlineSnapshot(`
      {
        "client": "
            export default defineNuxtPlugin({
              name: 'test',
              dependsOn: ["client-plugin"],
              setup: () => {},
            })
          ",
        "server": "
            export default defineNuxtPlugin({
              name: 'test',
              dependsOn: ["server-plugin"],
              setup: () => {},
            })
          ",
      }
    `)
  })
})

describe('plugin sanity checking', () => {
  it('filters and warns about non-existent dependencies in development', () => {
    vi.spyOn(console, 'warn')
    const plugins = filterPluginDependencies([
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
    ], { warn: true })
    expect(plugins[1]?.dependsOn).toEqual([])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Plugin `B` depends on `D` but they are not registered.'))
    vi.restoreAllMocks()
  })

  it('distinguishes dependencies unavailable in the build target from unregistered plugins', () => {
    vi.spyOn(console, 'warn')
    const allPlugins = [
      { name: 'client', src: '', mode: 'client' as const },
      { name: 'server', src: '', mode: 'server' as const },
      { name: 'universal', dependsOn: ['client', 'server', 'missing'], src: '' },
    ]
    const plugins = filterPluginDependencies(allPlugins.filter(plugin => plugin.mode !== 'server'), {
      warn: true,
      mode: 'client',
      allPlugins,
    })
    expect(plugins[1]?.dependsOn).toEqual(['client'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Plugin `universal` depends on `server`, but this dependency is unavailable in the client build and will be ignored.'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Do not depend on plugins that are unavailable in the same build environment; remove them from the `dependsOn` array.'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Plugin `universal` depends on `missing` but they are not registered.'))
    vi.restoreAllMocks()
  })

  it('filters non-existent dependencies without warning in production', () => {
    vi.spyOn(console, 'warn')
    const source = [
      { name: 'A', src: '' },
      { name: 'B', dependsOn: ['A', 'D'], src: '' },
    ]
    const plugins = filterPluginDependencies(source)
    expect(plugins[1]?.dependsOn).toEqual(['A'])
    expect(source[1]?.dependsOn).toEqual(['A', 'D'])
    expect(console.warn).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('preserves dependencies when plugin metadata is unknown', () => {
    const plugins = [
      { name: 'A', src: '', _metaUnknown: true },
      { name: 'B', dependsOn: ['A', 'D'], src: '' },
    ]
    expect(filterPluginDependencies(plugins)).toBe(plugins)
    expect(plugins[1]?.dependsOn).toEqual(['A', 'D'])
  })

  it('warns about missing dependencies even when plugin metadata is unknown', () => {
    vi.spyOn(console, 'warn')
    const plugins = [
      { name: 'A', src: '', _metaUnknown: true },
      { name: 'B', dependsOn: ['A', 'D'], src: '' },
    ]
    expect(filterPluginDependencies(plugins, { warn: true })).toBe(plugins)
    expect(plugins[1]?.dependsOn).toEqual(['A', 'D'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Plugin `B` depends on `D` but they are not registered.'))
    vi.restoreAllMocks()
  })

  it('circular dependencies are warned', () => {
    vi.spyOn(console, 'warn')
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
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: A -> B -> C -> A'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: B -> C -> A -> B'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: C -> A -> B -> C'))
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
