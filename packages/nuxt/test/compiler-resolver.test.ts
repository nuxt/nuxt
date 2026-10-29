import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { win32 } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import type { Component } from 'nuxt/schema'
import { kebabCase } from 'scule'
import { componentDiagnostics } from '@nuxt/kit/internal'
import { createComponentResolver } from '../src/components/compiler-resolver.ts'
import type { ComponentResolverOptions } from '../src/components/compiler-resolver.ts'
import { ComponentWrapperPlugin } from '../src/components/plugins/component-wrappers.ts'

const require = createRequire(import.meta.url)

const serverPlaceholderPath = '/nuxt/app/components/server-placeholder.js'

function component (pascalName: string, overrides: Partial<Component> = {}): Component {
  return {
    pascalName,
    kebabName: kebabCase(pascalName),
    export: 'default',
    filePath: `/app/components/${pascalName}.vue`,
    shortPath: `components/${pascalName}.vue`,
    chunkName: `components/${kebabCase(pascalName)}`,
    prefetch: false,
    preload: false,
    ...overrides,
  }
}

const components: Component[] = [
  component('Plain'),
  component('PlainKebab'),
  component('Heavy'),
  component('Line'),
  component('TimeLine'),
  component('Wrapper'),
  component('FallbackThing'),
  component('OnlyInClientOnly'),
  component('NestedInClientOnly'),
  component('InnerOfClient'),
  component('Named', { export: 'NamedExport', filePath: '/app/components/named.ts' }),
  component('ClientOnly', { filePath: '/nuxt/app/components/client-only.js' }),
  component('BrowserWidget', { mode: 'client', filePath: '/app/components/BrowserWidget.client.vue' }),
  component('BrowserWidget', { mode: 'server', _raw: true, filePath: serverPlaceholderPath }),
  component('IslandThing', { mode: 'server', filePath: '/app/components/IslandThing.server.vue' }),
  component('ServerPlaceholder', { filePath: serverPlaceholderPath }),
]

function createResolver (options: Partial<ComponentResolverOptions> = {}) {
  return createComponentResolver({
    getComponents: () => components,
    rootDir: '/app',
    serverPlaceholderPath,
    lazyHydration: true,
    experimentalComponentIslands: true,
    ...options,
  })
}

type Resolver = ReturnType<typeof createResolver>

interface CompileOptions {
  ssr?: boolean
  inline?: boolean
  filename?: string
  resolver?: Resolver
}

function compile (source: string, { ssr = false, inline = true, filename = '/app/pages/index.vue', resolver = createResolver() }: CompileOptions = {}) {
  const { descriptor } = parse(source, { filename })
  const compilerOptions = { nodeTransforms: [resolver.nodeTransform] }
  const preprocessOptions = descriptor.template!.lang
    ? { preprocessLang: descriptor.template!.lang, preprocessOptions: { doctype: 'html' }, preprocessCustomRequire: (id: string) => require(id) }
    : { ast: descriptor.template!.ast }
  const templateOptions = { ssr, ssrCssVars: [], compilerOptions, ...preprocessOptions }
  if (descriptor.scriptSetup && inline) {
    return compileScript(descriptor, { id: 'x', inlineTemplate: true, templateOptions }).content
  }
  const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, { id: 'x', templateOptions }) : undefined
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename,
    id: 'x',
    ssr,
    ssrCssVars: [],
    ...preprocessOptions,
    compilerOptions: { ...compilerOptions, bindingMetadata: script?.bindings },
  })
  if (template.errors.length) {
    throw template.errors[0]
  }
  return (script?.content || '') + '\n' + template.code
}

const VUE_IMPORT_RE = / from "vue(?:\/server-renderer)?"/

function imports (code: string) {
  return code.split('\n').filter(line => line.startsWith('import ') && !VUE_IMPORT_RE.test(line))
}

function wrappers (code: string, resolver: Resolver) {
  return imports(code).map((line) => {
    const id = line.match(/'(\/virtual:nuxt-component:[^']+)'/)?.[1]
    const wrapper = id && resolver.getWrapper(id)
    return wrapper ? `${wrapper.kind}${wrapper.clientOnly ? ' (client only)' : ''}: ${wrapper.component.filePath}` : line
  })
}

const modes = [{ ssr: false, mode: 'client' }, { ssr: true, mode: 'server' }]

describe('components:compiler-resolver', () => {
  describe.each(modes)('$mode', ({ ssr }) => {
    it('imports plain and kebab-case components in a template-only SFC', () => {
      const code = compile(`<template><div><Plain /><plain-kebab /><Named /><RouterLink /></div></template>`, { ssr })
      expect(imports(code)).toEqual([
        `import _component_Plain from '/app/components/Plain.vue'`,
        `import _component_plain_kebab from '/app/components/PlainKebab.vue'`,
        `import { NamedExport as _component_Named } from '/app/components/named.ts'`,
      ])
      expect(code).toContain('_resolveComponent("RouterLink")')
      expect(code).not.toContain('_resolveComponent("Plain")')
      expect(code).not.toContain('_resolveComponent("plain-kebab")')
    })

    it('removes the resolveComponent helper when every tag is resolved', () => {
      const code = compile(`<template><Plain /></template>`, { ssr })
      expect(code).not.toContain('resolveComponent')
    })

    it.each([true, false])('prefers components imported in <script setup> (inline: %s)', (inline) => {
      const code = compile(`
        <script setup>
        import Plain from './Local.vue'
        </script>
        <template><Plain /><plain-kebab /></template>
      `, { ssr, inline })
      expect(imports(code).sort()).toEqual([
        `import Plain from './Local.vue'`,
        `import _component_plain_kebab from '/app/components/PlainKebab.vue'`,
      ])
    })

    it('resolves components in an Options API SFC', () => {
      const code = compile(`
        <script>
        export default { data: () => ({ Plain: 1 }) }
        </script>
        <template><Plain /></template>
      `, { ssr })
      expect(imports(code)).toEqual([`import _component_Plain from '/app/components/Plain.vue'`])
    })

    it('imports lazy components through a wrapper', () => {
      const resolver = createResolver()
      const code = compile(`<template><LazyHeavy /><lazy-plain /><LazyBrowserWidget /></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual([
        'lazy: /app/components/Heavy.vue',
        'lazy: /app/components/Plain.vue',
        ssr ? `lazy: ${serverPlaceholderPath}` : 'lazy (client only): /app/components/BrowserWidget.client.vue',
      ])
    })

    it('applies hydration strategies from props and tag names', () => {
      const resolver = createResolver()
      const code = compile(`
        <template>
          <LazyHeavy hydrate-on-visible />
          <LazyPlain :hydrate-after="2000" />
          <lazy-plain-kebab hydrateOnMediaQuery="(max-width: 500px)" />
          <LazyIdleNamed />
          <lazy-interaction-wrapper />
        </template>
      `, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual([
        'lazy-Visible: /app/components/Heavy.vue',
        'lazy-Time: /app/components/Plain.vue',
        'lazy-MediaQuery: /app/components/PlainKebab.vue',
        'lazy-Idle: /app/components/named.ts',
        'lazy-Interaction: /app/components/Wrapper.vue',
      ])
      expect(code).not.toContain('resolveComponent')
    })

    it('uses the first hydration strategy and warns about the rest', () => {
      const spy = vi.spyOn(componentDiagnostics, 'NUXT_B3005').mockImplementation(() => ({}) as ReturnType<typeof componentDiagnostics.NUXT_B3005>)
      const resolver = createResolver()
      const code = compile(`<template><Wrapper><LazyHeavy hydrate-on-idle hydrate-never /></Wrapper></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toContain('lazy-Idle: /app/components/Heavy.vue')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('ignores hydration props on components without the Lazy prefix', () => {
      const code = compile(`<template><Heavy hydrate-on-visible /></template>`, { ssr })
      expect(imports(code)).toEqual([`import _component_Heavy from '/app/components/Heavy.vue'`])
    })

    it('ignores hydration props when lazy hydration is disabled', () => {
      const resolver = createResolver({ lazyHydration: false })
      const code = compile(`<template><LazyHeavy hydrate-on-visible /></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual(['lazy: /app/components/Heavy.vue'])
    })

    it('imports client and server components', () => {
      const resolver = createResolver()
      const code = compile(`<template><BrowserWidget /><IslandThing /></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual([
        ssr ? `import _component_BrowserWidget from '${serverPlaceholderPath}'` : 'client: /app/components/BrowserWidget.client.vue',
        'server: /app/components/IslandThing.server.vue',
      ])
    })

    it('uses one deterministic wrapper per importer', () => {
      const a = imports(compile(`<template><LazyHeavy /></template>`, { ssr, filename: '/app/pages/a.vue' }))
      const b = imports(compile(`<template><LazyHeavy /></template>`, { ssr, filename: '/app/pages/b.vue' }))
      const again = imports(compile(`<template><LazyHeavy /></template>`, { ssr, filename: '/app/pages/a.vue' }))
      expect(a).not.toEqual(b)
      expect(a).toEqual(again)
    })

    it('decodes wrappers from the module id alone', () => {
      const code = compile(`<template><LazyNamed hydrate-on-idle /><LazyBrowserWidget /><IslandThing /></template>`, { ssr })
      const resolver = createResolver({ getComponents: () => [] })
      expect(imports(code).map(line => resolver.getWrapper(line.match(/'([^']+)'/)![1]!))).toEqual([
        { kind: 'lazy-Idle', clientOnly: false, component: { pascalName: 'Named', filePath: '/app/components/named.ts', export: 'NamedExport' } },
        ssr
          ? { kind: 'lazy', clientOnly: false, component: { pascalName: 'BrowserWidget', filePath: serverPlaceholderPath, export: 'default' } }
          : { kind: 'lazy', clientOnly: true, component: { pascalName: 'BrowserWidget', filePath: '/app/components/BrowserWidget.client.vue', export: 'default' } },
        { kind: 'server', clientOnly: false, component: { pascalName: 'IslandThing', filePath: '/app/components/IslandThing.server.vue', export: 'default' } },
      ])
    })

    it('resolves self references to the auto-imported component', () => {
      const code = compile(`<template><Plain /></template>`, { ssr, filename: '/app/components/Plain.vue' })
      expect(imports(code)).toEqual([`import _component_Plain from '/app/components/Plain.vue'`])
      expect(code).not.toContain('resolveComponent')
    })

    it('leaves self references without a matching component to Vue', () => {
      const code = compile(`<template><Index /></template>`, { ssr })
      expect(imports(code)).toEqual([])
      expect(code).toContain('_resolveComponent("Index", true)')
    })

    it('leaves dynamic components to Vue', () => {
      const code = compile(`<template><component :is="foo" /><component is="Plain" /><Component is="vue:Plain" /></template>`, { ssr })
      expect(imports(code)).toEqual([])
      expect(code).toContain('_resolveDynamicComponent(_ctx.foo)')
      expect(code).toContain('_resolveDynamicComponent("Plain")')
      expect(code).not.toContain('resolveComponent(')
    })

    it('resolves the component named by a `vue:` is attribute', () => {
      const code = compile(`<template><div is="vue:Heavy" /><Wrapper :is="foo" /></template>`, { ssr })
      expect(imports(code)).toEqual([
        `import _component_Heavy from '/app/components/Heavy.vue'`,
        `import _component_Wrapper from '/app/components/Wrapper.vue'`,
      ])
      expect(code).not.toContain('resolveComponent(')
    })

    it('does not treat hydration strategy names as modifiers without the Lazy prefix', () => {
      const code = compile(`<template><TimeLine /><Line /><VisibleHeavy /></template>`, { ssr })
      expect(imports(code)).toEqual([
        `import _component_TimeLine from '/app/components/TimeLine.vue'`,
        `import _component_Line from '/app/components/Line.vue'`,
      ])
      expect(code).toContain('_resolveComponent("VisibleHeavy")')
    })

    it('prefers an exact match over a hydration strategy modifier', () => {
      const resolver = createResolver()
      const code = compile(`<template><LazyTimeLine /></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual(['lazy: /app/components/TimeLine.vue'])
    })

    it('falls back to a hydration strategy modifier when there is no exact match', () => {
      const resolver = createResolver({ getComponents: () => components.filter(c => c.pascalName !== 'TimeLine') })
      const code = compile(`<template><LazyTimeLine /><TimeLine /></template>`, { ssr, resolver })
      expect(wrappers(code, resolver)).toEqual(['lazy-Time: /app/components/Line.vue'])
      expect(code).toContain('_resolveComponent("TimeLine")')
    })

    it.each([true, false])('resolves components in pug templates (inline: %s)', (inline) => {
      const resolver = createResolver()
      const code = compile(`
        <script setup>
        import Local from './Local.vue'
        </script>
        <template lang="pug">
        div
          plain-kebab
          LazyHeavy(hydrate-on-visible)
          ClientOnly
            OnlyInClientOnly
            Local
            template(#fallback)
              FallbackThing
        </template>
      `, { ssr, inline, resolver })
      expect(wrappers(code, resolver).filter(line => !line.includes('./Local.vue'))).toEqual([
        `import _component_plain_kebab from '/app/components/PlainKebab.vue'`,
        'lazy-Visible: /app/components/Heavy.vue',
        `import _component_ClientOnly from '/nuxt/app/components/client-only.js'`,
        ...ssr ? [] : [`import _component_OnlyInClientOnly from '/app/components/OnlyInClientOnly.vue'`],
        `import _component_FallbackThing from '/app/components/FallbackThing.vue'`,
      ])
      expect(code).not.toContain('resolveComponent')
      expect(resolver.prunedBindings.get('/app/pages/index.vue')).toEqual(ssr ? new Set(['Local']) : undefined)
    })

    it('skips files excluded from the components transform', () => {
      const resolver = createResolver({ transform: { exclude: [/pages\/excluded/] } })
      const code = compile(`<template><Plain /></template>`, { ssr, resolver, filename: '/app/pages/excluded.vue' })
      expect(imports(code)).toEqual([])
      expect(code).toContain('_resolveComponent("Plain")')
    })
  })

  describe('<ClientOnly>', () => {
    const fallbacks = {
      'without an expression': `<template #fallback><FallbackThing /></template>`,
      'with an expression': `<template #fallback="{ attrs }"><FallbackThing v-bind="attrs" /></template>`,
      'as a placeholder slot': `<template #placeholder><FallbackThing /></template>`,
    }

    it.each(Object.entries(fallbacks))('keeps the fallback slot %s on the server', (_, fallback) => {
      const source = `<template><ClientOnly><OnlyInClientOnly />${fallback}</ClientOnly></template>`
      expect(imports(compile(source, { ssr: true }))).toEqual([
        `import _component_ClientOnly from '/nuxt/app/components/client-only.js'`,
        `import _component_FallbackThing from '/app/components/FallbackThing.vue'`,
      ])
      expect(imports(compile(source))).toEqual([
        `import _component_ClientOnly from '/nuxt/app/components/client-only.js'`,
        `import _component_OnlyInClientOnly from '/app/components/OnlyInClientOnly.vue'`,
        `import _component_FallbackThing from '/app/components/FallbackThing.vue'`,
      ])
    })

    it('removes the default slot of <client-only> and <LazyClientOnly> on the server', () => {
      const code = compile(`<template><client-only><Heavy /></client-only><LazyClientOnly><Plain /></LazyClientOnly></template>`, { ssr: true })
      expect(code).not.toContain('Heavy')
      expect(code).not.toContain('Plain')
    })

    it('removes the default slot when nested in another component\'s slot on the server', () => {
      const code = compile(`
        <template>
          <Wrapper>
            <div><ClientOnly><NestedInClientOnly /></ClientOnly></div>
            <template #named>
              <ClientOnly><OnlyInClientOnly /><template #fallback><FallbackThing /></template></ClientOnly>
            </template>
          </Wrapper>
        </template>
      `, { ssr: true })
      expect(imports(code)).toEqual([
        `import _component_Wrapper from '/app/components/Wrapper.vue'`,
        `import _component_ClientOnly from '/nuxt/app/components/client-only.js'`,
        `import _component_FallbackThing from '/app/components/FallbackThing.vue'`,
      ])
      expect(code).not.toContain('NestedInClientOnly')
      expect(code).not.toContain('OnlyInClientOnly')
      expect(code).not.toContain('resolveComponent')
    })

    it('keeps components that are also used outside <ClientOnly> on the server', () => {
      const code = compile(`<template><Heavy /><ClientOnly><Heavy /></ClientOnly></template>`, { ssr: true })
      expect(imports(code)).toContain(`import _component_Heavy from '/app/components/Heavy.vue'`)
    })

    it.each([true, false])('records <script setup> bindings removed from the server build (inline: %s)', (inline) => {
      const resolver = createResolver()
      const source = `
        <script setup>
        import Local from './Local.vue'
        import Shared from './Shared.vue'
        import * as ui from './ui'
        </script>
        <template>
          <Wrapper><ClientOnly><Local /><Shared /><ui.Button /><Heavy /></ClientOnly></Wrapper>
          <Shared />
          <BrowserWidget><local /></BrowserWidget>
        </template>
      `
      compile(source, { ssr: true, inline, resolver })
      expect([...resolver.prunedBindings.get('/app/pages/index.vue')!].sort()).toEqual(['Local', 'Shared', 'ui'])
      compile(source, { inline, resolver, filename: '/app/pages/client.vue' })
      expect(resolver.prunedBindings.has('/app/pages/client.vue')).toBe(false)
      compile(`<template><ClientOnly><Heavy /></ClientOnly></template>`, { ssr: true, resolver })
      expect(resolver.prunedBindings.has('/app/pages/index.vue')).toBe(false)
    })

    it('removes the slots of client-only components on the server', () => {
      const code = compile(`<template><Wrapper><BrowserWidget><InnerOfClient /></BrowserWidget></Wrapper></template>`, { ssr: true })
      expect(imports(code)).toEqual([
        `import _component_Wrapper from '/app/components/Wrapper.vue'`,
        `import _component_BrowserWidget from '${serverPlaceholderPath}'`,
      ])
      expect(code).not.toContain('InnerOfClient')
    })
  })

  it('ignores module ids that do not describe a wrapper', () => {
    const resolver = createResolver()
    expect(resolver.getWrapper('/virtual:nuxt-component:lazy:Heavy:abc:not-json')).toBeUndefined()
    expect(resolver.getWrapper(`/virtual:nuxt-component:x:y:z:${Buffer.from(JSON.stringify(['unknown', 'Heavy', './a.vue', 'default', false])).toString('base64url')}`)).toBeUndefined()
  })

  describe('resolution records', () => {
    it('records the resolution of each tag per mode', () => {
      const resolver = createResolver({ trackResolutions: true })
      compile(`<template><Plain /><BrandNew /><component :is="x" /></template>`, { resolver })
      compile(`<template><Heavy /></template>`, { resolver, ssr: true, filename: '/app/pages/other.vue' })
      expect(Object.fromEntries(resolver.resolutions.client.get('/app/pages/index.vue')!)).toEqual({
        Plain: '/app/components/Plain.vue#default',
        BrandNew: undefined,
      })
      expect([...resolver.resolutions.server.keys()]).toEqual(['/app/pages/other.vue'])
    })

    it('detects when a tag resolves differently', () => {
      let list = components
      const resolver = createResolver({ trackResolutions: true, getComponents: () => list })
      compile(`<template><BrandNew /></template>`, { resolver })
      const [tag, key] = [...resolver.resolutions.client.get('/app/pages/index.vue')!][0]!
      list = [...components, component('BrandNew')]
      expect(resolver.resolutionKey(resolver.resolveTag(tag, 'client', '/app/pages/index.vue'))).not.toBe(key)
    })
  })

  describe('wrapper modules', () => {
    it('resolves wrapper ids normalised to Windows separators', () => {
      const resolver = createResolver()
      const raw = ComponentWrapperPlugin({
        resolver,
        mode: 'client',
        srcDir: '/app',
        serverComponentRuntime: '/server-runtime.mjs',
        clientDelayedComponentRuntime: '/client-runtime.mjs',
      }).raw({}, { framework: 'vite', versions: {} }) as any
      const id = imports(compile(`<template><LazyHeavy /></template>`, { resolver }))[0]!.match(/'([^']+)'/)![1]!

      for (const request of [id, win32.normalize(id)]) {
        expect(raw.resolveId.filter.id.test(request)).toBe(true)
        expect(raw.resolveId.handler(request)).toBe(`\0${id}`)
      }
      expect(raw.load.handler(`\0${id}`)).toContain('defineAsyncComponent(() => import("/app/components/Heavy.vue")')
    })
  })

  describe('hot updates', () => {
    function setup (mode: 'client' | 'server' = 'client') {
      let registry = components
      const setComponents = (update: (list: Component[]) => Component[]) => { registry = update(registry) }
      const refreshed: string[] = []
      const resolver = createResolver({ trackResolutions: true, getComponents: () => registry })
      const raw = ComponentWrapperPlugin({
        resolver,
        mode,
        srcDir: '/app',
        serverComponentRuntime: '/server-runtime.mjs',
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        refreshComponents: (file) => {
          if (file.startsWith('/app/components/')) {
            refreshed.push(file)
            return Promise.resolve()
          }
        },
      }).raw({}, { framework: 'vite', versions: {} }) as any
      const graph = new Map<string, { id: string }>()
      const transform = (filename: string, source: string) => {
        graph.set(filename, { id: filename })
        compile(source, { resolver, filename, ssr: mode === 'server' })
      }
      const hotUpdate = (type: string, file: string, modules: unknown[] = []) =>
        raw.vite.hotUpdate.handler.call({ environment: { moduleGraph: { getModuleById: (id: string) => graph.get(id) } } }, { type, file, modules })
      return { setComponents, refreshed, transform, hotUpdate, graph }
    }

    it.each(['client', 'server'] as const)('updates templates referencing a newly added component (%s)', async (mode) => {
      const { setComponents, transform, hotUpdate, graph } = setup(mode)
      transform('/app/pages/unresolved.vue', '<template><BrandNew /></template>')
      transform('/app/pages/lazy.vue', '<template><LazyBrandNew hydrate-on-visible /></template>')
      transform('/app/pages/unrelated.vue', '<template><Plain /></template>')

      setComponents(list => [...list, component('BrandNew')])

      expect(await hotUpdate('create', '/app/components/BrandNew.vue')).toEqual([graph.get('/app/pages/unresolved.vue'), graph.get('/app/pages/lazy.vue')])
    })

    it('updates templates whose component was removed', async () => {
      const { setComponents, refreshed, transform, hotUpdate, graph } = setup()
      transform('/app/pages/uses.vue', '<template><Heavy /></template>')
      transform('/app/pages/unrelated.vue', '<template><Plain /></template>')

      setComponents(list => list.filter(c => c.pascalName !== 'Heavy'))
      const own = { id: '/app/components/Heavy.vue' }

      expect(await hotUpdate('delete', '/app/components/Heavy.vue', [own])).toEqual([own, graph.get('/app/pages/uses.vue')])
      expect(refreshed).toEqual(['/app/components/Heavy.vue'])
    })

    it('updates templates when a component moves to a file with the same name', async () => {
      const { setComponents, transform, hotUpdate, graph } = setup()
      transform('/app/pages/plain.vue', '<template><Heavy /></template>')
      transform('/app/pages/lazy.vue', '<template><LazyHeavy hydrate-on-idle /></template>')
      transform('/app/pages/unrelated.vue', '<template><Plain /></template>')

      setComponents(list => list.map(c => c.pascalName === 'Heavy' ? { ...c, filePath: '/app/components/heavy/Heavy.vue' } : c))

      expect(await hotUpdate('create', '/app/components/heavy/Heavy.vue')).toEqual([graph.get('/app/pages/plain.vue'), graph.get('/app/pages/lazy.vue')])
    })

    it('ignores updates, non-component files and unchanged resolutions', async () => {
      const { refreshed, transform, hotUpdate } = setup()
      transform('/app/pages/uses.vue', '<template><Plain /></template>')

      expect(await hotUpdate('update', '/app/components/Plain.vue')).toBeUndefined()
      expect(await hotUpdate('create', '/app/utils/foo.ts')).toBeUndefined()
      expect(await hotUpdate('create', '/app/components/Unused.vue')).toBeUndefined()
      expect(refreshed).toEqual(['/app/components/Unused.vue'])
    })

    it('forgets templates that are no longer in the module graph', async () => {
      const { setComponents, transform, hotUpdate, graph } = setup()
      transform('/app/pages/gone.vue', '<template><BrandNew /></template>')
      graph.delete('/app/pages/gone.vue')

      setComponents(list => [...list, component('BrandNew')])

      expect(await hotUpdate('create', '/app/components/BrandNew.vue')).toBeUndefined()
    })
  })
})
