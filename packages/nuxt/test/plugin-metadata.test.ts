import { describe, expect, it } from 'vitest'
import { parse } from 'acorn'

import { RemovePluginMetadataPlugin, extractMetadata } from '../src/core/plugins/plugin-metadata'

describe('plugin-metadata', () => {
  it('should extract metadata from object-syntax plugins', async () => {
    const properties = Object.entries({
      name: 'test',
      enforce: 'post',
      hooks: { 'app:mounted': () => {} },
      setup: () => {},
      order: 1
    })

    for (const item of properties) {
      const obj = [...properties.filter(([key]) => key !== item[0]), item]

      const meta = await extractMetadata([
        'export default defineNuxtPlugin({',
        ...obj.map(([key, value]) => `${key}: ${typeof value === 'function' ? value.toString() : JSON.stringify(value)},`),
        '})'
      ].join('\n'))

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
    apps: { default: { plugins: [{ src: 'my-plugin.mjs', order: 10 }] } }
  } as any).raw({}, {} as any)

  it('should overwrite invalid plugins', () => {
    const invalidPlugins = [
      'export const plugin = {}',
      'export default function (ctx, inject) {}'
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
