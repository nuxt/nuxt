import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { type IslandsV2Registry, islandsV2ManifestPlugin } from '../src/plugins/islands-v2/manifest'
import { toChunkRef } from '../src/plugins/islands-v2/compiler/paths'

const root = resolve('/project/app')
const MANIFEST_ID = '\0nuxt:islands-v2-manifest'

function load (consumer: 'client' | 'server', targets: string[]) {
  const registry: IslandsV2Registry = {
    targets: new Map(targets.map(target => [target, toChunkRef(target, root)])),
    components: new Map(),
  }
  const plugin = islandsV2ManifestPlugin(registry)
  const ctx = { environment: { config: { consumer, root } } }
  return (plugin.load as (this: typeof ctx, id: string) => string).call(ctx, MANIFEST_ID)
}

describe('islandsV2ManifestPlugin', () => {
  it('keys each client loader once, under the chunk ref the server marker carries', () => {
    const target = `${root}/components/Foo.vue`
    const code = load('client', [target])
    expect(code).toContain(`"/components/Foo.vue": () => import("${target}")`)
    expect(code.split('import(')).toHaveLength(2)
    expect(code).toContain('__createImportFn(__table)')
  })

  it('keys targets outside the root by a path relative to it', () => {
    const target = resolve(root, '../layers/base/app/components/Bar.vue')
    const code = load('client', [target])
    expect(code).toMatch(/"\.\.\/layers\/base\/app\/components\/Bar\.vue": /)
  })

  it('keys targets inside node_modules by their package specifier', () => {
    const target = `${root}/node_modules/.pnpm/dep@1.0.0/node_modules/@scope/dep/src/Comp.vue`
    expect(toChunkRef(target, root)).toBe('@scope/dep/src/Comp.vue')
    expect(load('client', [target])).toContain(`"@scope/dep/src/Comp.vue": () => import("${target}")`)
  })

  it('emits no loaders for server environments', () => {
    const code = load('server', [`${root}/components/Foo.vue`])
    expect(code).not.toContain('import(')
    expect(code).toContain('export function importFn')
    expect(code).toContain('export const chunkPaths = {}')
  })
})

describe('islandsV2ManifestPlugin with remote islands', () => {
  const inRoot = `${root}/components/Foo.vue`
  const outside = resolve(root, '../layers/base/app/components/Bar.vue')

  function setup (dev: boolean) {
    const registry: IslandsV2Registry = {
      targets: new Map([inRoot, outside].map(target => [target, toChunkRef(target, root)])),
      components: new Map(),
    }
    return islandsV2ManifestPlugin(registry, { remote: { dev, buildAssetsDir: '/_nuxt/' } })
  }

  function call<T> (plugin: ReturnType<typeof setup>, hook: 'buildStart' | 'generateBundle' | 'load', ctx: object, ...args: unknown[]): T {
    const value = plugin[hook] as ((...args: unknown[]) => T) | { handler: (...args: unknown[]) => T }
    return (typeof value === 'function' ? value : value.handler).apply(ctx, args)
  }

  it('serves the dev server module paths, relative to the base URL', () => {
    const code = call<string>(setup(true), 'load', { environment: { config: { consumer: 'server', root } } }, MANIFEST_ID)
    expect(code).toContain('"/components/Foo.vue": "/_nuxt/components/Foo.vue"')
    expect(code).toContain(`"../layers/base/app/components/Bar.vue": "/_nuxt/@fs/${outside.replace(/^\//, '')}"`)
  })

  it('emits each target as its own client chunk and exports its built path to the server', () => {
    const plugin = setup(false)
    const emitted: Array<{ id: string, preserveSignature: string }> = []
    const client = {
      environment: { config: { consumer: 'client', root } },
      emitFile: (file: { id: string, preserveSignature: string }) => { emitted.push(file); return `ref-${emitted.length}` },
      getFileName: (ref: string) => `_nuxt/${ref}.js`,
    }
    call(plugin, 'buildStart', client)
    expect(emitted).toEqual([
      expect.objectContaining({ id: inRoot, preserveSignature: 'strict' }),
      expect.objectContaining({ id: outside, preserveSignature: 'strict' }),
    ])

    const bundle = {
      'a': { type: 'chunk', fileName: '_nuxt/ref-1.js', isEntry: true },
      'entry': { type: 'chunk', fileName: '_nuxt/entry.js', isEntry: true },
    }
    call(plugin, 'generateBundle', client, {}, bundle)
    expect(bundle.a.isEntry).toBe(false)
    expect(bundle.entry.isEntry).toBe(true)

    const code = call<string>(plugin, 'load', { environment: { config: { consumer: 'server', root } } }, MANIFEST_ID)
    expect(code).toContain('"/components/Foo.vue": "/_nuxt/ref-1.js"')
    expect(code).toContain('"../layers/base/app/components/Bar.vue": "/_nuxt/ref-2.js"')
  })

  it('emits nothing for server environments', () => {
    const emitFile = () => { throw new Error('unexpected emit') }
    expect(() => call(setup(false), 'buildStart', { environment: { config: { consumer: 'server', root } }, emitFile })).not.toThrow()
  })
})
