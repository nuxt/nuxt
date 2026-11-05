import { describe, expect, it } from 'vitest'
import { compileTemplate } from '@vue/compiler-sfc'
import type { NodeTransform } from '@vue/compiler-dom'
import type { Nuxt } from '@nuxt/schema'
import { type ClientTargetLookup, createSsrLoadClientTransform } from '../src/plugins/islands-v2/compiler/ssr-load-client'
import { withIslandsV2NodeTransform } from '../src/plugins/islands-v2'

const SERVER_MODULE = '#app/components/islands-v2/server'
const SSR_RUNTIME_MODULE = '#app/components/islands-v2/ssr-runtime'
const FILE = '/project/app/components/Test.vue'

const TARGETS: Record<string, { chunk: string, exportName: string }> = {
  Foo: { chunk: '/components/Foo.vue', exportName: 'default' },
  Bar: { chunk: '/components/Bar.vue', exportName: 'Bar' },
}
const lookup: ClientTargetLookup = (file, tag) => file === FILE ? TARGETS[tag] : undefined

function compile (source: string, ssr: boolean, ssrRuntimeModuleName?: string) {
  return compileTemplate({
    source,
    filename: FILE,
    id: 'test',
    ssr,
    compilerOptions: { nodeTransforms: [createSsrLoadClientTransform(lookup)], ssrRuntimeModuleName },
  }).code
}

describe('createSsrLoadClientTransform', () => {
  it('passes `enabled`, chunk and export name as literals', () => {
    const code = compile('<div><Foo v-load-client /><Bar v-load-client="cond" /><Baz /></div>', true)
    expect(code).toContain('_islandRenderClient(_component_Foo, null, null, _parent, undefined, "/components/Foo.vue", "default")')
    expect(code).toContain('_islandRenderClient(_component_Bar, null, null, _parent, _ctx.cond, "/components/Bar.vue", "Bar")')
    expect(code).toContain('_ssrRenderComponent(_component_Baz')
    expect(code.split(SERVER_MODULE)).toHaveLength(2)
  })

  it('emits `undefined` chunk and export for unscanned targets', () => {
    const code = compile('<div><Missing v-load-client /></div>', true)
    expect(code).toContain('_islandRenderClient(_component_Missing, null, null, _parent, undefined, undefined, undefined)')
  })

  it('keeps Vue\'s appended scope id last and uses the vnode boundary in the slot fallback branch', () => {
    const code = compile('<Wrapper><Foo v-load-client="ok" /></Wrapper>', true)
    expect(code).toContain('_islandRenderClient(_component_Foo, null, null, _parent, _ctx.ok, "/components/Foo.vue", "default", _scopeId)')
    expect(code).toMatch(/_createVNode\(_islandClientBoundary, \{\s*is: _component_Foo,\s*props: null,\s*enabled: _ctx\.ok,\s*chunk: "\/components\/Foo\.vue",\s*exportName: "default"\s*\}\)/)
    expect(code.split(SERVER_MODULE)).toHaveLength(2)
  })

  it('renders dynamic components through the vnode statement helper without a chunk', () => {
    const code = compile('<component :is="X" v-load-client />', true)
    expect(code).toContain('_islandRenderClientVNode(_push, _resolveDynamicComponent(_ctx.X), _attrs, null, _parent, undefined, undefined, undefined)')
  })

  it('imports SSR helpers from `ssrRuntimeModuleName`', () => {
    const code = compile('<Teleport to="body"><p>hi</p></Teleport>', true, SSR_RUNTIME_MODULE)
    expect(code).toContain(`from "${SSR_RUNTIME_MODULE}"`)
    expect(code).toContain('_ssrRenderTeleport(_push,')
    expect(code).not.toContain('vue/server-renderer')
    expect(code).not.toContain(SERVER_MODULE)
  })

  it('leaves templates without the directive untouched', () => {
    expect(compile('<div><Foo /></div>', true)).not.toContain(SERVER_MODULE)
  })

  it('only drops the directive in client compiles', () => {
    const code = compile('<div><Foo v-load-client="cond" /></div>', false)
    expect(code).toContain('_createVNode(_component_Foo)')
    expect(code).not.toContain('_island')
    expect(code).not.toContain('load-client')
  })
})

describe('withIslandsV2NodeTransform', () => {
  const nuxt = (componentIslands: unknown) => ({ options: { experimental: { componentIslands } } }) as unknown as Nuxt

  it('appends the transform after user transforms and sets the SSR runtime module', () => {
    const userTransform: NodeTransform = () => {}
    const options = { template: { compilerOptions: { nodeTransforms: [userTransform] } } }
    const compilerOptions = withIslandsV2NodeTransform(nuxt('v2'), options).template?.compilerOptions
    expect(compilerOptions?.nodeTransforms).toHaveLength(2)
    expect(compilerOptions?.nodeTransforms?.[0]).toBe(userTransform)
    expect(compilerOptions?.ssrRuntimeModuleName).toBe(SSR_RUNTIME_MODULE)
    expect(options.template.compilerOptions.nodeTransforms).toEqual([userTransform])
    expect(withIslandsV2NodeTransform(nuxt('v2')).template?.compilerOptions?.nodeTransforms).toHaveLength(1)
  })

  it('leaves options untouched without islands v2', () => {
    const options = { template: {} }
    expect(withIslandsV2NodeTransform(nuxt(true), options)).toBe(options)
  })
})
