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
  })
})
