import { describe, expect, it, vi } from 'vitest'

import { RemovePluginMetadataPlugin, extractMetadata, setPluginDependenciesForMode } from '../src/core/plugins/plugin-metadata.ts'
import { annotatePlugins, assertNoCircularPluginDependencies, breakCircularDependencies, filterPluginDependencies, hasPluginCapability, sortPluginsByDependsOn } from '../src/core/app.ts'
import { clientPluginTemplate } from '../src/core/templates.ts'

describe('plugin-metadata', () => {
  const properties = Object.entries({
    name: 'test',
    enforce: 'post',
    hooks: { 'app:mounted': () => {} },
    setup: () => { return { provide: { jsx: '[JSX]' } } },
    order: 1,
  })
  it.each(properties)('should extract metadata from object-syntax plugins when `%s` is declared last', (k, value) => {
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

  it.each([
    ['`as const`', 'const name = \'test\'\nexport default defineNuxtPlugin({ name, dependsOn: [\'a\'] as const, parallel: true as boolean })'],
    ['`satisfies`', 'export default defineNuxtPlugin(({ name: \'test\', dependsOn: [\'a\'], parallel: true }) satisfies object)'],
    ['template literals', 'export default defineNuxtPlugin({ name: `test`, dependsOn: [`a`], parallel: true })'],
    ['top-level constants', 'export const NAME = \'test\'\nconst DEPS = [\'a\']\nexport default defineNuxtPlugin({ name: NAME, dependsOn: DEPS, parallel: true })'],
    ['an aliased import', 'import { defineNuxtPlugin as define } from \'#app\'\nexport default define({ name: \'test\', dependsOn: [\'a\'], parallel: true })'],
    ['top-level constants read from a nested call', 'const NAME = \'test\'\nexport default (() => {\n  const other = \'unrelated\'\n  return defineNuxtPlugin({ name: NAME, dependsOn: [\'a\'], parallel: true })\n})()'],
  ])('should extract static metadata written with %s', (_, code) => {
    expect(extractMetadata(code)).toEqual({ name: 'test', dependsOn: ['a'], parallel: true, order: 0 })
  })

  it.each([
    ['-0x10', -16],
    ['-1_000', -1000],
  ])('should extract `order: %s`', (order, expected) => {
    expect(extractMetadata(`export default defineNuxtPlugin({ order: ${order} })`)).toEqual({ order: expected })
  })

  it.each([
    ['name', 'import { NAME } from \'./constants\'\nexport default defineNuxtPlugin({ name: NAME, enforce: \'pre\' })', { order: -20 }],
    ['parallel', 'export default defineNuxtPlugin({ name: \'test\', parallel: import.meta.client })', { name: 'test', order: 0 }],
    ['enforce', 'let enforce = \'pre\'\nexport default defineNuxtPlugin({ name: \'test\', enforce })', { name: 'test', order: 0 }],
    ['name', 'const NAME = \'outer\'\nexport default (() => {\n  const NAME = \'inner\'\n  return defineNuxtPlugin({ name: NAME })\n})()', { order: 0 }],
  ])('should warn about a non-static `%s` and keep the static metadata', (key, code, meta) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(extractMetadata(code)).toEqual({ ...meta, _metaUnknown: true })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`The \`${key}\` option of a plugin is not a static value.`))
    vi.restoreAllMocks()
  })

  it('should not resolve a constant shadowed by a local binding declared after the plugin call', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const code = [
      'const DEPS = [\'a\']',
      'export default (() => {',
      '  const create = () => defineNuxtPlugin({ name: \'test\', dependsOn: DEPS })',
      '  const DEPS = [\'b\']',
      '  return create()',
      '})()',
    ].join('\n')
    expect(extractMetadata(code)).toEqual({ name: 'test', order: 0, _metaUnknown: true })
    vi.restoreAllMocks()
  })

  it('should warn about a non-static `dependsOn` and keep the static metadata', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(extractMetadata('import { deps } from \'./deps\'\nexport default defineNuxtPlugin({ name: \'test\', dependsOn: deps })')).toEqual({ name: 'test', order: 0, _metaUnknown: true })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`dependsOn` is not an array of string literals.'))
    vi.restoreAllMocks()
  })

  it.each([
    ['an imported identifier', 'import myPlugin from \'./external\'\nexport default defineNuxtPlugin(myPlugin)', 'Identifier'],
    ['a factory call', 'import { make } from \'./factory\'\nexport default defineNuxtPlugin(make(), { enforce: \'pre\' })', 'CallExpression'],
    ['a member access', 'import * as ext from \'./external\'\nexport default defineNuxtPlugin(ext.plugin, { enforce: \'pre\' })', 'MemberExpression'],
  ])('should warn about %s as the plugin and keep the static metadata', (_, code, type) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(extractMetadata(code)).toEqual({ order: code.includes('enforce') ? -20 : 0, _metaUnknown: true })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`The plugin passed to \`defineNuxtPlugin\` is a \`${type}\`, not an object literal or a function.`))
    vi.restoreAllMocks()
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

  it.each([
    ['a constant', 'dependsOn: DEPS'],
    ['a shorthand property', 'dependsOn'],
  ])('should rewrite `dependsOn` written as %s inside a type assertion', (_, property) => {
    const filterNuxt = {
      options: { sourcemap: { client: true } },
      apps: { default: { plugins: [{ src: 'my-plugin.mjs' }] } },
    } as any
    setPluginDependenciesForMode(filterNuxt, 'client', [{ src: 'my-plugin.mjs', dependsOn: ['a'] }])
    const plugin = `
      const DEPS = ['a', 'b']
      const dependsOn = DEPS
      export default defineNuxtPlugin({
        name: 'test',
        ${property},
      } satisfies object)
    `
    expect((RemovePluginMetadataPlugin(filterNuxt, 'client').raw({}, {} as any) as any).transform(plugin, 'my-plugin.mjs').code).toContain('dependsOn: ["a"],')
  })

  it.each([
    ['', ''],
    [' when it is declared by a plugin whose other metadata cannot be statically analysed', ', parallel: import.meta.client'],
  ])('should emit plugins without the dependency that closes a cycle%s', async (_, options) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = { plugins: [{ src: '/app/a.ts' }, { src: '/app/b.ts' }] }
    const cycleNuxt = {
      options: { dev: false, rootDir: '/app', alias: {}, sourcemap: { client: true } },
      apps: { default: app },
      vfs: {
        '/app/a.ts': 'export default defineNuxtPlugin({ name: \'a\', dependsOn: [\'b\'] })',
        '/app/b.ts': `export default defineNuxtPlugin({ name: 'b', dependsOn: ['a']${options} })`,
      },
    } as any
    const contents = await clientPluginTemplate.getContents!({ nuxt: cycleNuxt, app, options: {} } as any)
    expect(contents.indexOf('/app/b.ts')).toBeLessThan(contents.indexOf('/app/a.ts'))
    const transform = (RemovePluginMetadataPlugin(cycleNuxt, 'client').raw({}, {} as any) as any).transform
    expect(transform(cycleNuxt.vfs['/app/b.ts'], '/app/b.ts')?.code).toContain('dependsOn: []')
    vi.restoreAllMocks()
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

  it('breaks circular dependencies and warns about the dropped dependency', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins = breakCircularDependencies([
      { name: 'D', dependsOn: ['B'], src: '' },
      { name: 'A', dependsOn: ['B'], src: '' },
      { name: 'B', dependsOn: ['C'], src: '' },
      { name: 'C', dependsOn: ['A'], src: '' },
    ])
    expect(plugins.map(plugin => plugin.dependsOn)).toEqual([['B'], [], ['C'], ['A']])
    expect(sortPluginsByDependsOn(plugins).map(plugin => plugin.name)).toEqual(['A', 'C', 'B', 'D'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: B -> C -> A -> B.'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Production builds fail until this is fixed; in development, plugin `A` does not wait for `B`.'))
    vi.restoreAllMocks()
  })

  it('only drops dependencies that close a cycle', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins = breakCircularDependencies([
      { name: 'C', dependsOn: ['D', 'A'], src: '' },
      { name: 'D', dependsOn: ['C'], src: '' },
      { name: 'A', dependsOn: ['B'], src: '' },
      { name: 'B', dependsOn: ['A'], src: '' },
    ])
    expect(plugins.map(plugin => plugin.dependsOn)).toEqual([['D', 'A'], [], ['B'], []])
    vi.restoreAllMocks()
  })

  it('does not treat a dependency on a name shared by several plugins as circular', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const source = [
      { name: 'X', src: '' },
      { name: 'A', dependsOn: ['X'], src: '' },
      { name: 'X', dependsOn: ['A'], src: '' },
    ]
    expect(breakCircularDependencies(source)).toEqual(source)
    expect(warn).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('breaks a cycle through a name shared by several plugins when none of them can run', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins = breakCircularDependencies([
      { name: 'A', dependsOn: ['X'], src: '' },
      { name: 'X', dependsOn: ['A'], src: '' },
      { name: 'X', dependsOn: ['A'], src: '' },
    ])
    expect(plugins.map(plugin => plugin.dependsOn)).toEqual([['X'], [], ['A']])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in plugins: A -> X -> A.'))
    vi.restoreAllMocks()
  })

  it('leaves plugins without circular dependencies untouched', () => {
    const source = [
      { name: 'A', src: '' },
      { name: 'B', dependsOn: ['A', 'missing'], src: '' },
    ]
    const plugins = breakCircularDependencies(source)
    expect(plugins[0]).toBe(source[0])
    expect(plugins[1]).toBe(source[1])
  })

  describe('build-time checks', () => {
    const fakeNuxt = {
      options: { rootDir: '/app', alias: {} },
      vfs: {
        '/app/plugins/static.ts': 'export default defineNuxtPlugin({ name: \'static\' })',
        '/app/plugins/factory.ts': 'export default defineNuxtPlugin(createPlugin())',
        '/app/plugins/a.ts': 'export default defineNuxtPlugin({ name: \'a\', dependsOn: [\'b\'] })',
        '/app/plugins/b.server.ts': 'export default defineNuxtPlugin({ name: \'b\', dependsOn: [\'a\'] })',
      },
    } as any

    it('pass when plugins do not depend on each other in a cycle', async () => {
      await expect(assertNoCircularPluginDependencies(fakeNuxt, [{ src: '/app/plugins/static.ts' }, { src: '/app/plugins/a.ts' }])).resolves.toBeUndefined()
    })

    it('warn and fall back to runtime metadata when plugin metadata cannot be statically analysed', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const plugins = [{ src: '/app/plugins/static.ts' }, { src: '/app/plugins/factory.ts' }]
      await expect(assertNoCircularPluginDependencies(fakeNuxt, plugins)).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\[NUXT_B2010\] Failed to parse static properties from plugin `[^`]*\/plugins\/factory\.ts`, falling back to non-optimized runtime meta\./))
      expect((await annotatePlugins(fakeNuxt, plugins)).map(plugin => plugin._metaUnknown ?? false)).toEqual([false, true])
      vi.restoreAllMocks()
    })

    it('report each plugin falling back to runtime metadata once, even when plugins share their source', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const code = 'export default defineNuxtPlugin(makeSharedPlugin())'
      const sharedNuxt = { options: { rootDir: '/app', alias: {} }, vfs: { '/app/one.ts': code, '/app/two.ts': code } } as any
      const plugins = [{ src: '/app/one.ts' }, { src: '/app/two.ts' }]
      await annotatePlugins(sharedNuxt, plugins)
      await annotatePlugins(sharedNuxt, plugins)
      const fallbacks = warn.mock.calls.map(args => String(args[0])).filter(message => message.includes('[NUXT_B2010]'))
      expect(fallbacks).toEqual([expect.stringContaining('one.ts'), expect.stringContaining('two.ts')])
      vi.restoreAllMocks()
    })

    it.each(['client', 'server'] as const)('fail when plugins depend on each other in a cycle in the %s build', async (mode) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      await expect(assertNoCircularPluginDependencies(fakeNuxt, [{ src: '/app/plugins/a.ts' }, { src: '/app/plugins/b.server.ts', mode }])).rejects.toThrow('Circular dependency detected in plugins: a -> b -> a.')
      vi.restoreAllMocks()
    })

    it('pass when a cycle only exists across the client and server builds', async () => {
      await expect(assertNoCircularPluginDependencies(fakeNuxt, [{ src: '/app/plugins/a.ts', mode: 'client' }, { src: '/app/plugins/b.server.ts', mode: 'server' }])).resolves.toBeUndefined()
    })
  })
})

describe('plugin capability probes', () => {
  const capabilities = ['dependsOn', 'parallel', 'hasHooks', 'hasEnv'] as const

  it('detect a capability used by any plugin', () => {
    expect(hasPluginCapability([{ dependsOn: [] }, { parallel: false }], 'dependsOn')).toBe(false)
    expect(hasPluginCapability([{}, { dependsOn: ['a'] }], 'dependsOn')).toBe(true)
    expect(hasPluginCapability([{ hasHooks: true }], 'parallel')).toBe(false)
    expect(hasPluginCapability([{ hasHooks: true }], 'hasHooks')).toBe(true)
  })

  it('do not flag function-syntax plugins as unknown (they cannot carry capability metadata)', () => {
    const shapes = {
      'arrow function': 'export default defineNuxtPlugin(() => {})',
      'anonymous function': 'export default defineNuxtPlugin(function (nuxt) {})',
    }

    for (const [label, code] of Object.entries(shapes)) {
      const meta = extractMetadata(code)
      expect(meta._metaUnknown ?? false, label).toBe(false)
      for (const capability of capabilities) {
        expect(hasPluginCapability([meta as never], capability), `${label} (${capability})`).toBe(false)
      }
    }
  })

  it('treat plugins that throw during static parse as unknown so runtime keeps full paths', () => {
    expect(() => extractMetadata('export default defineNuxtPlugin({ ...options })')).toThrow()

    const fallback = { _metaUnknown: true as const }
    for (const capability of capabilities) {
      expect(hasPluginCapability([fallback], capability), capability).toBe(true)
    }
  })
})
