import { describe, expect, it, vi } from 'vitest'

import { RemovePluginMetadataPlugin, extractMetadata } from '../src/core/plugins/plugin-metadata.ts'
import { checkForCircularDependencies } from '../src/core/app.ts'

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

describe('lazy plugin metadata', () => {
  describe('defineLazyNuxtPlugin', () => {
    it('extracts lazy from arrow function', () => {
      const meta = extractMetadata(`export default defineLazyNuxtPlugin(() => {})`)
      expect(meta).toEqual({ lazy: true, order: 0 })
    })

    it('extracts lazy from named-param arrow function', () => {
      const meta = extractMetadata(`export default defineLazyNuxtPlugin((nuxtApp) => {})`)
      expect(meta).toEqual({ lazy: true, order: 0 })
    })

    it('extracts lazy from async function', () => {
      const meta = extractMetadata(`export default defineLazyNuxtPlugin(async (nuxtApp) => { await something() })`)
      expect(meta).toEqual({ lazy: true, order: 0 })
    })

    it('extracts lazy + name from object syntax', () => {
      const meta = extractMetadata(`export default defineLazyNuxtPlugin({ name: 'analytics', setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, name: 'analytics', order: 0 })
    })
  })

  describe('defineNuxtPlugin with lazy: true', () => {
    it('extracts lazy from object syntax', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin({ lazy: true, setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, order: 0 })
    })

    it('extracts lazy: false as falsy (omitted)', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin({ lazy: false, setup: () => {} })`)
      // lazy: false is falsy, order defaults to 0
      expect(meta).toEqual({ lazy: false, order: 0 })
    })

    it('extracts lazy with name and enforce', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin({ lazy: true, name: 'tracking', enforce: 'post', setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, name: 'tracking', order: 20 })
    })

    it('extracts lazy with custom order', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin({ lazy: true, order: 5, setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, order: 5 })
    })
  })

  describe('non-lazy plugins', () => {
    it('does not include lazy for function-syntax defineNuxtPlugin', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin(() => {})`)
      expect(meta).toEqual({})
    })

    it('does not include lazy for object-syntax defineNuxtPlugin without lazy', () => {
      const meta = extractMetadata(`export default defineNuxtPlugin({ name: 'foo', setup: () => {} })`)
      expect(meta).toEqual({ name: 'foo', order: 0 })
    })
  })

  describe('edge cases', () => {
    it('defineLazyNuxtPlugin with redundant lazy: true in object syntax', () => {
      const meta = extractMetadata(`export default defineLazyNuxtPlugin({ lazy: true, name: 'double', setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, name: 'double', order: 0 })
    })

    it('defineLazyNuxtPlugin with lazy: false in object syntax still gets lazy from wrapper', () => {
      // defineLazyNuxtPlugin always forces lazy: true, regardless of object properties
      const meta = extractMetadata(`export default defineLazyNuxtPlugin({ lazy: false, setup: () => {} })`)
      expect(meta).toEqual({ lazy: true, order: 0 })
    })
  })

  describe('RemovePluginMetadataPlugin strips lazy', () => {
    const transformPlugin: any = RemovePluginMetadataPlugin({
      options: { sourcemap: { client: true } },
      apps: { default: { plugins: [{ src: 'lazy-plugin.mjs', order: 0, lazy: true }] } },
    } as any).raw({}, {} as any)

    it('should remove name and lazy from object-syntax lazy plugin', () => {
      const plugin = `
        export default defineNuxtPlugin({
          name: 'analytics',
          lazy: true,
          setup: () => {},
        })
      `
      const result = transformPlugin.transform(plugin, 'lazy-plugin.mjs')
      expect(result.code).toMatchInlineSnapshot(`
        "
                export default defineNuxtPlugin({
                  setup: () => {},
                })
              "
      `)
    })

    it('should strip lazy when it is the only metadata property', () => {
      const onlyLazyPlugin: any = RemovePluginMetadataPlugin({
        options: { sourcemap: { client: true } },
        apps: { default: { plugins: [{ src: 'only-lazy.mjs', lazy: true }] } },
      } as any).raw({}, {} as any)

      const plugin = `
        export default defineNuxtPlugin({
          lazy: true,
          setup: () => {},
        })
      `
      const result = onlyLazyPlugin.transform(plugin, 'only-lazy.mjs')
      expect(result.code).toMatchInlineSnapshot(`
        "
                export default defineNuxtPlugin({
                  setup: () => {},
                })
              "
      `)
    })
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
    expect(console.error).toHaveBeenCalledWith('Plugin `B` depends on `D` but they are not registered.')
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
    expect(console.error).toHaveBeenCalledWith('Circular dependency detected in plugins: A -> B -> C -> A')
    expect(console.error).toHaveBeenCalledWith('Circular dependency detected in plugins: B -> C -> A -> B')
    expect(console.error).toHaveBeenCalledWith('Circular dependency detected in plugins: C -> A -> B -> C')
    vi.restoreAllMocks()
  })
})
