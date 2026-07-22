import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import type { Nuxt } from 'nuxt/schema'

import { DollarFetchGlobalPlugin } from '../src/core/plugins/fetch-global.ts'

const nuxt = { options: { rootDir: '/project', buildDir: '/project/.nuxt', sourcemap: { client: false } } } as unknown as Nuxt
const plugin = DollarFetchGlobalPlugin(nuxt).raw({}, { framework: 'vite', versions: {} }) as Plugin

async function transform (code: string, id = '/project/app/plugins/test.ts') {
  const { handler, filter } = plugin.transform as { handler: (code: string, id: string) => Promise<{ code: string } | undefined>, filter: { code: { include: RegExp } } }
  if (!filter.code.include.test(code)) {
    return
  }
  return (await handler(code, id))?.code
}

describe('fetch global plugin', () => {
  it.each([
    ['a bare reference', 'export const load = () => $fetch(\'/api\')'],
    ['`globalThis.$fetch`', 'export const load = () => globalThis.$fetch(\'/api\')'],
    ['`window.$fetch`', 'export const fetcher = window.$fetch'],
    ['`self[\'$fetch\']`', 'export const fetcher = self[\'$fetch\']'],
    ['optional chaining on `globalThis`', 'export const fetcher = globalThis?.$fetch'],
  ])('installs the global for %s', async (_name, code) => {
    expect(await transform(code)).toBe(`import '#build/fetch-global';\n${code}`)
  })

  it('installs the global for a module without imports or exports', async () => {
    expect(await transform('window.$fetch(\'/api/ping\')')).toBe(`import '#build/fetch-global';\nwindow.$fetch('/api/ping')`)
  })

  it('installs the global for code in node_modules', async () => {
    expect(await transform('export const load = () => $fetch(\'/api\')', '/project/node_modules/some-module/dist/runtime/plugin.js'))
      .toContain('#build/fetch-global')
  })

  it.each([
    ['a property of another object', 'export const load = app => app.$fetch(\'/api\')'],
    ['a local binding', 'const $fetch = globalThis.fetch\nexport const load = () => $fetch(\'/api\')'],
    ['an imported binding', 'import { $fetch } from \'#build/fetch\'\nexport const load = () => $fetch(\'/api\')'],
  ])('leaves %s', async (_name, code) => {
    expect(await transform(code)).toBeUndefined()
  })

  it('leaves CommonJS modules, ofetch and the fetch templates', async () => {
    expect(await transform('module.exports = () => $fetch(\'/api\')', '/project/node_modules/legacy/index.js')).toBeUndefined()
    expect(await transform('export const $fetch = createFetch()\nexport default $fetch', '/project/node_modules/ofetch/dist/index.mjs')).toBeUndefined()
    expect(await transform('import { $fetch } from \'#build/fetch\'\nglobalThis.$fetch ||= $fetch', '/project/.nuxt/fetch-global.mjs')).toBeUndefined()
    expect(await transform('import { $fetch } from \'#build/fetch\'\nglobalThis.$fetch ||= $fetch', `virtual:nuxt:${encodeURIComponent('.nuxt/fetch-global.mjs')}`)).toBeUndefined()
    expect(await transform('export const $fetch = (() => globalThis.$fetch ||= create())()', `/virtual:nuxt:${encodeURIComponent('.nuxt/fetch.client.mjs')}?v=1`)).toBeUndefined()
  })
})
