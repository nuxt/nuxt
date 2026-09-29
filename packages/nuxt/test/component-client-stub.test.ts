import { describe, expect, it } from 'vitest'
import type { Component } from '@nuxt/schema'
import { ClientComponentStubPlugin } from '../src/components/plugins/client-component-stub.ts'

const SERVER_PLACEHOLDER = '/nuxt/app/components/server-placeholder.ts'

function component (partial: Partial<Component> & { filePath: string }): Component {
  return {
    pascalName: 'Component',
    kebabName: 'component',
    chunkName: 'components/component',
    shortPath: partial.filePath,
    export: 'default',
    prefetch: false,
    preload: false,
    mode: 'all',
    ...partial,
  } as Component
}

function createResolver (componentsOrGetter: Component[] | (() => Component[]), dev = false) {
  const raw = ClientComponentStubPlugin({
    getComponents: typeof componentsOrGetter === 'function' ? componentsOrGetter : () => componentsOrGetter,
    serverPlaceholderPath: SERVER_PLACEHOLDER,
    alias: { '~': '/src', '@': '/src' },
    dev,
  }).raw({}, { framework: 'rollup' } as any)

  const plugin = Array.isArray(raw) ? raw[0]! : raw
  const hook = plugin.resolveId!
  if (typeof hook === 'function') {
    return (id: string, importer?: string) => hook.call({} as any, id, importer, { isEntry: false })
  }

  // apply the hook filter the way the bundler does, so the tests cover it too
  const include = (hook.filter!.id as { include: RegExp[] }).include
  return (id: string, importer?: string) => {
    if (!include.some(pattern => pattern.test(id))) { return }
    return hook.handler.call({} as any, id, importer, { isEntry: false })
  }
}

describe('components:client-component-stub', () => {
  const clientOnly = component({ filePath: '/src/components/Interactive.client.vue', pascalName: 'Interactive', mode: 'client' })

  it('stubs absolute, aliased and relative imports of a client-only component', () => {
    const resolveId = createResolver([clientOnly])

    expect(resolveId('/src/components/Interactive.client.vue')).toBe(SERVER_PLACEHOLDER)
    expect(resolveId('~/components/Interactive.client')).toBe(SERVER_PLACEHOLDER)
    expect(resolveId('~/components/Interactive.client.vue')).toBe(SERVER_PLACEHOLDER)
    expect(resolveId('./Interactive.client.vue', '/src/components/Page.vue')).toBe(SERVER_PLACEHOLDER)
    expect(resolveId('../components/Interactive.client', '/src/pages/index.vue')).toBe(SERVER_PLACEHOLDER)
  })

  it('does not stub other components or same-named files elsewhere', () => {
    const resolveId = createResolver([clientOnly])

    expect(resolveId('/src/components/Interactive.vue')).toBeUndefined()
    expect(resolveId('/src/other/Interactive.client.vue')).toBeUndefined()
    expect(resolveId('vue')).toBeUndefined()
    expect(resolveId('#components')).toBeUndefined()
  })

  it('does not stub components registered through `#components`', () => {
    const resolveId = createResolver([clientOnly])

    expect(resolveId('/src/components/Interactive.client.vue?nuxt_component=client&nuxt_component_name=Interactive&nuxt_component_export=default')).toBeUndefined()
  })

  it('stubs a client component registered at a path without a `.client` suffix', () => {
    const resolveId = createResolver([
      component({ filePath: '/module/runtime/interactive.ts', pascalName: 'Interactive', mode: 'client' }),
    ])

    expect(resolveId('/module/runtime/interactive.ts')).toBe(SERVER_PLACEHOLDER)
  })

  it('does not stub a file also registered in another mode', () => {
    const shared = '/src/runtime/components.ts'
    const resolveId = createResolver([
      component({ filePath: shared, pascalName: 'NCompClient', export: 'NComp', mode: 'client' }),
      component({ filePath: shared, pascalName: 'NCompServer', export: 'NComp', mode: 'server' }),
      component({ filePath: shared, pascalName: 'NCompAll', export: 'NComp', mode: 'all' }),
    ])

    expect(resolveId(shared)).toBeUndefined()
  })

  it('does not stub a client component exposing a named export', () => {
    const resolveId = createResolver([
      component({ filePath: '/src/components/Named.client.ts', pascalName: 'Named', export: 'Named', mode: 'client' }),
    ])

    expect(resolveId('/src/components/Named.client.ts')).toBeUndefined()
  })

  it('picks up components discovered by a later scan', () => {
    let components: Component[] = []
    const resolveId = createResolver(() => components)

    expect(resolveId('/src/components/Interactive.client.vue')).toBeUndefined()

    components = [clientOnly]
    expect(resolveId('/src/components/Interactive.client.vue')).toBe(SERVER_PLACEHOLDER)
  })

  it('is not filtered in dev, where a later scan can add a component at any path', () => {
    let components: Component[] = []
    const resolveId = createResolver(() => components, true)

    components = [component({ filePath: '/module/runtime/interactive.ts', pascalName: 'Interactive', mode: 'client' })]
    expect(resolveId('/module/runtime/interactive.ts')).toBe(SERVER_PLACEHOLDER)
  })
})
