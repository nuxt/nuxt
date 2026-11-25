import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import escapeStringRegexp from 'escape-string-regexp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { RemovePluginMetadataPlugin, extractMetadata, setPluginDependenciesForMode } from '../src/core/plugins/plugin-metadata.ts'
import { annotatePlugins, assertNoCircularPluginDependencies, breakCircularDependencies, filterPluginDependencies, hasPluginCapability, sortPluginsByDependsOn } from '../src/core/app.ts'
import { clientPluginTemplate } from '../src/core/templates.ts'

async function metadataWarnings (code: string) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await annotatePlugins({ options: { rootDir: '/app', alias: {} }, vfs: { '/app/plugins/test.ts': code } } as any, [{ src: '/app/plugins/test.ts' }])
  const warnings = warn.mock.calls.map(args => String(args[0]))
  vi.restoreAllMocks()
  return warnings
}

function pluginWarning (code: string, why: string, file = '/plugins/test.ts') {
  return expect.stringMatching(new RegExp(`^\\[${code}\\] ${escapeStringRegexp(why)}\n[\\s\\S]*sources: \\S*${escapeStringRegexp(file)}$`))
}

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
    ['a top-level constant holding a build flag', 'const PARALLEL = import.meta.client\nexport default defineNuxtPlugin({ name: \'test\', dependsOn: [\'a\'], parallel: PARALLEL })'],
    ['an aliased import', 'import { defineNuxtPlugin as define } from \'#app\'\nexport default define({ name: \'test\', dependsOn: [\'a\'], parallel: true })'],
    ['top-level constants referencing a name shadowed at the call site', 'const NAME = \'test\'\nconst DEP = \'a\'\nconst DEPS = [DEP]\nexport default (() => {\n  const DEP = \'unused\'\n  return defineNuxtPlugin({ name: NAME, dependsOn: DEPS, parallel: true })\n})()'],
    ['top-level constants read from a nested call', 'const NAME = \'test\'\nexport default (() => {\n  const other = \'unrelated\'\n  return defineNuxtPlugin({ name: NAME, dependsOn: [\'a\'], parallel: true })\n})()'],
  ])('should extract static metadata written with %s', (_, code) => {
    expect(extractMetadata(code)).toEqual({ name: 'test', dependsOn: ['a'], parallel: true, order: 0 })
  })

  it.each(['server', 'client', 'dev', 'test', 'prerender', 'browser', 'nitro'])('should treat `import.meta.%s` as a static `parallel` value', async (flag) => {
    const code = `export default defineNuxtPlugin({ name: 'test', parallel: import.meta.${flag} })`
    expect(await metadataWarnings(code)).toEqual([])
    expect(extractMetadata(code)).toEqual({ name: 'test', parallel: true, order: 0 })
  })

  it.each([
    ['-0x10', -16],
    ['-1_000', -1000],
  ])('should extract `order: %s`', (order, expected) => {
    expect(extractMetadata(`export default defineNuxtPlugin({ order: ${order} })`)).toEqual({ order: expected })
  })

  it.each([
    ['name', 'from an import', 'import { NAME } from \'./constants\'\nexport default defineNuxtPlugin({ name: NAME, enforce: \'pre\' })', { order: -20 }],
    ['parallel', 'from `import.meta.env`', 'export default defineNuxtPlugin({ name: \'test\', parallel: import.meta.env.SSR })', { name: 'test', order: 0 }],
    ['order', 'from a build flag', 'export default defineNuxtPlugin({ name: \'test\', order: import.meta.server })', { name: 'test', order: 0 }],
    ['enforce', 'from a `let` binding', 'let enforce = \'pre\'\nexport default defineNuxtPlugin({ name: \'test\', enforce })', { name: 'test', order: 0 }],
    ['name', 'from a constant shadowed at the call site', 'const NAME = \'outer\'\nexport default (() => {\n  const NAME = \'inner\'\n  return defineNuxtPlugin({ name: NAME })\n})()', { order: 0 }],
  ])('should warn about a non-static `%s` %s and keep the static metadata', async (key, _, code, meta) => {
    expect(await metadataWarnings(code)).toEqual([pluginWarning('NUXT_B2014', `The \`${key}\` option of a plugin is not a static value.`)])
    expect(extractMetadata(code)).toEqual({ ...meta, _metaUnknown: true })
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

  it.each([
    ['an import', 'import { deps } from \'./deps\'\nexport default defineNuxtPlugin({ name: \'test\', dependsOn: deps })'],
    ['a conditional on a build-time constant', 'export default defineNuxtPlugin({ name: \'test\', dependsOn: !__PRELOAD__ ? [\'a\'] : [\'b\'] })'],
  ])('should warn about a non-static `dependsOn` from %s and keep the static metadata', async (_, code) => {
    expect(await metadataWarnings(code)).toEqual([pluginWarning('NUXT_B2003', '`dependsOn` is not an array of string literals.')])
    expect(extractMetadata(code)).toEqual({ name: 'test', order: 0, _metaUnknown: true })
  })

  it('should report only the first property that cannot be statically analysed', async () => {
    expect(await metadataWarnings('export default defineNuxtPlugin({ name: \'test\', parallel: __PARALLEL__, dependsOn: DEPS })')).toEqual([pluginWarning('NUXT_B2014', 'The `parallel` option of a plugin is not a static value.')])
  })

  it.each([
    ['NUXT_B2001', 'export default defineNuxtPlugin(() => {}, options)', 'The second argument to `defineNuxtPlugin` is a `Identifier`, not an object literal.'],
    ['NUXT_B2002', 'export default defineNuxtPlugin({ ...options })', 'Plugin options contain spread elements or computed keys, which are not supported.'],
  ])('should report %s once, naming the plugin', async (code, source, why) => {
    expect(await metadataWarnings(source)).toEqual([pluginWarning(code, why)])
  })

  it.each([
    ['an imported identifier', 'import myPlugin from \'./external\'\nexport default defineNuxtPlugin(myPlugin)', 'Identifier'],
    ['a factory call', 'import { make } from \'./factory\'\nexport default defineNuxtPlugin(make(), { enforce: \'pre\' })', 'CallExpression'],
    ['a member access', 'import * as ext from \'./external\'\nexport default defineNuxtPlugin(ext.plugin, { enforce: \'pre\' })', 'MemberExpression'],
  ])('should warn about %s as the plugin and keep the static metadata', async (_, code, type) => {
    expect(await metadataWarnings(code)).toEqual([pluginWarning('NUXT_B2013', `The plugin passed to \`defineNuxtPlugin\` is a \`${type}\`, not an object literal or a function.`)])
    expect(extractMetadata(code)).toEqual({ order: code.includes('enforce') ? -20 : 0, _metaUnknown: true })
  })

  const nuxt = {
    options: { sourcemap: { client: true } },
    apps: { default: { plugins: [{ src: 'my-plugin.mjs', order: 10 }] } },
  } as any
  const transformPlugin: any = RemovePluginMetadataPlugin(nuxt, 'client').raw({}, {} as any)

  it('only lets plugin files reach the transform in a build', () => {
    const buildNuxt = {
      options: { dev: false, sourcemap: { client: true } },
      apps: { default: { plugins: [{ src: '/app/plugins/a.ts' }, { src: '/app/.nuxt/b (1).mjs' }] } },
    } as any
    const { filter } = (RemovePluginMetadataPlugin(buildNuxt, 'client').raw({}, {} as any) as any).transform
    expect(filter?.id.test('/app/plugins/a.ts')).toBe(true)
    expect(filter?.id.test('/app/.nuxt/b (1).mjs')).toBe(true)
    expect(filter?.id.test('/app/plugins/a.ts?macro=true')).toBe(false)
    expect(filter?.id.test('/app/plugins/a.tsx')).toBe(false)
    expect(filter?.id.test('/app/components/a.vue')).toBe(false)

    const windowsNuxt = { options: { dev: false }, apps: { default: { plugins: [{ src: 'C:/app/plugins/a.ts' }] } } } as any
    const windowsFilter = (RemovePluginMetadataPlugin(windowsNuxt, 'client').raw({}, {} as any) as any).transform.filter
    expect(windowsFilter.id.test('C:/app/plugins/a.ts')).toBe(true)
    expect(windowsFilter.id.test('c:/app/plugins/a.ts')).toBe(true)
    expect(windowsFilter.id.test('C:\\app\\plugins\\a.ts')).toBe(true)
    expect(windowsFilter.id.test('D:/app/plugins/a.ts')).toBe(false)

    const emptyNuxt = { options: { dev: false }, apps: { default: { plugins: [] } } } as any
    expect((RemovePluginMetadataPlugin(emptyNuxt, 'client').raw({}, {} as any) as any).transform.filter?.id.test('/app/a.ts')).toBe(false)

    const devNuxt = { options: { dev: true }, hook: () => {}, apps: { default: { plugins: [] } } } as any
    expect((RemovePluginMetadataPlugin(devNuxt, 'client').raw({}, {} as any) as any).transform.filter).toBeUndefined()
  })

  it('should overwrite invalid plugins', () => {
    const invalidPlugins = [
      'export const plugin = {}',
    ]
    for (const plugin of invalidPlugins) {
      expect(transformPlugin.transform.handler(plugin, 'my-plugin.mjs').code).toBe('export default () => {}')
    }
  })

  it('should warn about an invalid plugin once across builds until it changes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const invalidNuxt = { options: {}, apps: { default: { plugins: [{ src: 'invalid-plugin.mjs' }] } } } as any
    const transform = (mode: 'client' | 'server', code: string) => (RemovePluginMetadataPlugin(invalidNuxt, mode).raw({}, {} as any) as any).transform.handler(code, 'invalid-plugin.mjs')

    transform('client', 'export const plugin = {}')
    transform('server', 'export const plugin = {}')
    expect(warn).toHaveBeenCalledTimes(1)

    transform('client', 'export const plugin = { changed: true }')
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('should warn again about a restored invalid plugin after it changes on disk in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const hooks: Record<string, (event: string, path: string) => void> = {}
    const devNuxt = {
      options: { dev: true, srcDir: '/app' },
      hook: (name: string, fn: (event: string, path: string) => void) => { hooks[name] = fn },
      apps: { default: { plugins: [{ src: '/app/plugins/invalid.mjs' }] } },
    } as any
    const plugin = RemovePluginMetadataPlugin(devNuxt, 'client').raw({}, {} as any) as any
    const edit = (code: string) => {
      hooks['builder:watch']!('change', 'plugins/invalid.mjs')
      plugin.transform.handler(code, '/app/plugins/invalid.mjs')
    }

    plugin.transform.handler('export const plugin = {}', '/app/plugins/invalid.mjs')
    edit('export default defineNuxtPlugin(() => {})')
    edit('export const plugin = {}')
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('should remove order/name properties from object-syntax plugins', () => {
    const plugin = `
      export default defineNuxtPlugin({
        name: 'test',
        enforce: 'post',
        setup: () => {},
      }, { order: 10, name: test })
    `
    expect(transformPlugin.transform.handler(plugin, 'my-plugin.mjs').code).toMatchInlineSnapshot(`
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
    const transform = (mode: 'client' | 'server') => (RemovePluginMetadataPlugin(filterNuxt, mode).raw({}, {} as any) as any).transform.handler(plugin, 'my-plugin.mjs').code
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
    expect((RemovePluginMetadataPlugin(filterNuxt, 'client').raw({}, {} as any) as any).transform.handler(plugin, 'my-plugin.mjs').code).toContain('dependsOn: ["a"],')
  })

  it.each([
    ['', ''],
    [' when it is declared by a plugin whose other metadata cannot be statically analysed', ', parallel: config.parallel'],
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
    const transform = (RemovePluginMetadataPlugin(cycleNuxt, 'client').raw({}, {} as any) as any).transform.handler
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
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Plugin `A` cannot wait for `B` while the cycle remains.'))
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
      expect(warn.mock.calls.map(args => String(args[0]))).toEqual([pluginWarning('NUXT_B2013', 'The plugin passed to `defineNuxtPlugin` is a `CallExpression`, not an object literal or a function.', '/plugins/factory.ts')])
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
      expect(warn.mock.calls.map(args => String(args[0]))).toEqual([expect.stringContaining('one.ts'), expect.stringContaining('two.ts')])
      vi.restoreAllMocks()
    })

    describe('for plugins shipped by dependencies', () => {
      const code = 'export default defineNuxtPlugin({ name: \'dependency\', dependsOn: !__PRELOAD__ ? [\'a\'] : [] })'
      let root: string

      beforeAll(async () => {
        root = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-plugin-metadata-')))
        for (const file of ['store/dep@1.0.0/node_modules/dep/plugin.js', 'app/node_modules/.pnpm/pnpm-dep@1.0.0/node_modules/pnpm-dep/plugin.js', 'local-module/plugin.js', 'app/plugins/project.ts']) {
          await mkdir(dirname(join(root, file)), { recursive: true })
          await writeFile(join(root, file), code)
        }
        await symlink(join(root, 'store/dep@1.0.0/node_modules/dep'), join(root, 'app/node_modules/dep'), 'dir')
        await symlink(join(root, 'app/node_modules/.pnpm/pnpm-dep@1.0.0/node_modules/pnpm-dep'), join(root, 'app/node_modules/pnpm-dep'), 'dir')
        await symlink(join(root, 'local-module'), join(root, 'app/node_modules/local-module'), 'dir')
      })

      afterAll(() => rm(root, { recursive: true, force: true }))

      async function annotate (file: string, options = {}) {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const [plugin] = await annotatePlugins({ options: { rootDir: join(root, 'app'), alias: {}, ...options }, vfs: {} } as any, [{ src: join(root, file) }])
        const warnings = warn.mock.calls.map(args => String(args[0]))
        vi.restoreAllMocks()
        return { plugin, warnings }
      }

      it.each([
        ['a pnpm symlink', 'app/node_modules/pnpm-dep/plugin.js'],
        ['its real path in the virtual store', 'app/node_modules/.pnpm/pnpm-dep@1.0.0/node_modules/pnpm-dep/plugin.js'],
        ['a symlink into a store outside the project', 'app/node_modules/dep/plugin.js'],
        ['its real path in a store outside the project', 'store/dep@1.0.0/node_modules/dep/plugin.js'],
      ])('fall back to runtime metadata without a warning when reached through %s', async (_, file) => {
        const { plugin, warnings } = await annotate(file)
        expect(plugin?._metaUnknown).toBe(true)
        expect(warnings).toEqual([])
      })

      it('warn when debugging modules', async () => {
        const { warnings } = await annotate('app/node_modules/dep/plugin.js', { debug: { modules: true } })
        expect(warnings).toEqual([pluginWarning('NUXT_B2003', '`dependsOn` is not an array of string literals.', 'node_modules/dep/plugin.js')])
      })

      it.each([
        ['a project plugin', 'app/plugins/project.ts'],
        ['a local module linked into `node_modules`', 'app/node_modules/local-module/plugin.js'],
      ])('still warn about %s', async (_, file) => {
        const { warnings } = await annotate(file)
        expect(warnings).toEqual([pluginWarning('NUXT_B2003', '`dependsOn` is not an array of string literals.', file.slice(file.indexOf('/')))])
      })
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
