import { describe, expect, it, vi } from 'vitest'
import { parse } from 'acorn'

import { RemovePluginMetadataPlugin, extractMetadata } from '../src/core/plugins/plugin-metadata'
import { checkForCircularDependencies } from '../src/core/app'

describe('plugin-metadata', () => {
  it('should extract metadata from object-syntax plugins', async () => {
    const properties = Object.entries({
      name: 'test',
      enforce: 'post',
      hooks: { 'app:mounted': () => {} },
      setup: () => { return { provide: { jsx: '[JSX]' } } },
      order: 1,
    })

    for (const item of properties) {
      const obj = [...properties.filter(([key]) => key !== item[0]), item]

      const meta = await extractMetadata([
        'export default defineNuxtPlugin({',
        ...obj.map(([key, value]) => `${key}: ${typeof value === 'function' ? value.toString().replace('"[JSX]"', '() => <span>JSX</span>') : JSON.stringify(value)},`),
        '})',
      ].join('\n'), 'tsx')

      expect(meta).toMatchInlineSnapshot(`
        {
          "name": "test",
          "order": 1,
        }
      `)
    }
  })

  const transformPlugin: any = RemovePluginMetadataPlugin({
    options: { sourcemap: { client: true } },
    apps: { default: { plugins: [{ src: 'my-plugin.mjs', order: 10 }] } },
  } as any).raw({}, {} as any)

  it('should overwrite invalid plugins', () => {
    const invalidPlugins = [
      'export const plugin = {}',
      'export default function (ctx, inject) {}',
    ]
    for (const plugin of invalidPlugins) {
      expect(transformPlugin.transform.call({ parse }, plugin, 'my-plugin.mjs').code).toBe('export default () => {}')
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
    expect(transformPlugin.transform.call({ parse }, plugin, 'my-plugin.mjs').code).toMatchInlineSnapshot(`
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
    expect(console.error).toBeCalledWith('Plugin `B` depends on `D` but they are not registered.')
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
    expect(console.error).toBeCalledWith('Circular dependency detected in plugins: A -> B -> C -> A')
    expect(console.error).toBeCalledWith('Circular dependency detected in plugins: B -> C -> A -> B')
    expect(console.error).toBeCalledWith('Circular dependency detected in plugins: C -> A -> B -> C')
    vi.restoreAllMocks()
  })
})
