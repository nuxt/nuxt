import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as VueCompilerSFC from 'vue/compiler-sfc'
import type { Plugin } from 'vite'
import { Parser } from 'acorn'
import type { Options } from '@vitejs/plugin-vue'
import _vuePlugin from '@vitejs/plugin-vue'
import { TreeShakeTemplatePlugin } from '../src/components/tree-shake'
import { fixtureDir, normalizeLineEndings } from './utils'

// mock due to differences of results between windows and linux
vi.spyOn(path, 'relative').mockImplementation((from: string, to: string) => {
  if (to.includes('SomeComponent')) {
    return to
  }
  return path.resolve(from, to)
})

function vuePlugin (options: Options) {
  return {
    ..._vuePlugin(options),
    handleHotUpdate () {},
    configureDevServer () {},
  }
}

const WithClientOnly = normalizeLineEndings(readFileSync(path.resolve(fixtureDir, './components/client/WithClientOnlySetup.vue')).toString())

const treeshakeTemplatePlugin = TreeShakeTemplatePlugin.raw({
  sourcemap: false,
  getComponents () {
    return [{
      pascalName: 'NotDotClientComponent',
      kebabName: 'not-dot-client-component',
      export: 'default',
      filePath: 'dummypath',
      shortPath: 'dummypath',
      chunkName: '123',
      prefetch: false,
      preload: false,
      mode: 'client',
    }, {
      pascalName: 'DotClientComponent',
      kebabName: 'dot-client-component',
      export: 'default',
      filePath: 'dummypath',
      shortPath: 'dummypath',
      chunkName: '123',
      prefetch: false,
      preload: false,
      mode: 'client',
    }]
  },
}, { framework: 'rollup' }) as Plugin

const treeshake = async (source: string): Promise<string> => {
  const result = await (treeshakeTemplatePlugin.transform! as Function).call({
    parse: (code: string, opts: any = {}) => Parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ...opts,
    }),
  }, source)
  return typeof result === 'string' ? result : result?.code
}

async function SFCCompile (name: string, source: string, options: Options, ssr = false): Promise<string> {
  const plugin = vuePlugin({
    compiler: VueCompilerSFC,
    ...options,
  })
  // @ts-expect-error Types are not correct as they are too generic
  plugin.configResolved!({
    isProduction: options.isProduction,
    command: 'build',
    root: process.cwd(),
    build: { sourcemap: false },
    define: {},
  })
  const result = await (plugin.transform! as Function).call({
    parse: (code: string, opts: any = {}) => Parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ...opts,
    }),
  }, source, name, {
    ssr,
  })

  return typeof result === 'string' ? result : result?.code
}

const stateToTest: { index: number, name: string, options: Partial<Options & { devServer: { config: { server: any } } }> }[] = [
  {
    index: 0,
    name: 'prod',
    options: {
      isProduction: true,
    },
  },
  {
    index: 1,
    name: 'dev',
    options: {
      isProduction: false,
      devServer: {
        config: {
          // trigger dev behavior
          server: false,
        },
      },
    },
  },
]

describe('treeshake client only in ssr', () => {
  vi.spyOn(process, 'cwd').mockImplementation(() => '')
  it.each(stateToTest)(`should treeshake ClientOnly correctly in $name`, async (state) => {
    // add index to avoid using vite vue plugin cache
    const clientResult = await SFCCompile(`SomeComponent${state.index}.vue`, WithClientOnly, state.options)

    const ssrResult = await SFCCompile(`SomeComponent${state.index}.vue`, WithClientOnly, state.options, true)

    const treeshaken = await treeshake(ssrResult)
    const [_, scopeId] = clientResult.match(/_pushScopeId\("(.*)"\)/)!

    // ensure the id is correctly passed between server and client
    expect(clientResult).toContain(`pushScopeId("${scopeId}")`)
    expect(treeshaken).toContain(`<div ${scopeId}>`)

    expect(clientResult).toContain('should-be-treeshaken')
    expect(treeshaken).not.toContain('should-be-treeshaken')

    expect(treeshaken).not.toContain('import HelloWorld from \'../HelloWorld.vue\'')
    expect(clientResult).toContain('import HelloWorld from \'../HelloWorld.vue\'')

    expect(treeshaken).not.toContain('import { Treeshaken } from \'somepath\'')
    expect(clientResult).toContain('import { Treeshaken } from \'somepath\'')

    // remove resolved import
    expect(treeshaken).not.toContain('const _component_ResolvedImport =')
    expect(clientResult).toContain('const _component_ResolvedImport =')

    // treeshake multi line variable declaration
    expect(clientResult).toContain('const SomeIsland = defineAsyncComponent(async () => {')
    expect(treeshaken).not.toContain('const SomeIsland = defineAsyncComponent(async () => {')
    expect(treeshaken).not.toContain('return (await import(\'./../some.island.vue\'))')
    expect(treeshaken).toContain('const NotToBeTreeShaken = defineAsyncComponent(async () => {')

    // treeshake object and array declaration
    expect(treeshaken).not.toContain('const { ObjectPattern } = await import(\'nuxt.com\')')
    expect(treeshaken).not.toContain('const { ObjectPattern: ObjectPatternDeclaration } = await import(\'nuxt.com\')')
    expect(treeshaken).toContain('const {  ButShouldNotBeTreeShaken } = defineAsyncComponent(async () => {')
    expect(treeshaken).toContain('const [ { Dont, }, That] = defineAsyncComponent(async () => {')

    // treeshake object that has an assignment pattern
    expect(treeshaken).toContain('const { woooooo, } = defineAsyncComponent(async () => {')
    expect(treeshaken).not.toContain('const { Deep, assignment: { Pattern = ofComponent } } = defineAsyncComponent(async () => {')

    // expect no empty ObjectPattern on treeshaking
    expect(treeshaken).not.toContain('const {  } = defineAsyncComponent')
    expect(treeshaken).not.toContain('import {  } from')

    // expect components used in setup to not be removed
    expect(treeshaken).toContain('import DontRemoveThisSinceItIsUsedInSetup from \'./ComponentWithProps.vue\'')

    // expect import of ClientImport to be treeshaken but not Glob since it is also used outside <ClientOnly>
    expect(treeshaken).not.toContain('ClientImport')
    expect(treeshaken).toContain('import {  Glob } from \'#components\'')

    // treeshake .client slot
    expect(treeshaken).not.toContain('ByeBye')
    // don't treeshake variables that has the same name as .client components
    expect(treeshaken).toContain('NotDotClientComponent')
    expect(treeshaken).not.toContain('(DotClientComponent')

    expect(treeshaken).not.toContain('AutoImportedComponent')
    expect(treeshaken).toContain('AutoImportedNotTreeShakenComponent')

    expect(treeshaken).not.toContain('Both')
    expect(treeshaken).not.toContain('AreTreeshaken')

    if (state.options.isProduction === false) {
      // treeshake at inlined template
      expect(treeshaken).not.toContain('ssrRenderComponent($setup["HelloWorld"]')
      expect(treeshaken).toContain('ssrRenderComponent($setup["Glob"]')
    } else {
      // treeshake unref
      expect(treeshaken).not.toContain('ssrRenderComponent(_unref(HelloWorld')
      expect(treeshaken).toContain('ssrRenderComponent(_unref(Glob')
    }
    expect(treeshaken.replace(/data-v-\w{8}/g, 'data-v-one-hash').replace(/scoped=\w{8}/g, 'scoped=one-hash')).toMatchSnapshot()
  })

  it('should not treeshake reused component #26137', async () => {
    const treeshaken = await treeshake(`import { resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode } from "vue"
    import { ssrRenderComponent as _ssrRenderComponent, ssrRenderAttrs as _ssrRenderAttrs } from "vue/server-renderer"

    export function ssrRender(_ctx, _push, _parent, _attrs) {
      const _component_AppIcon = _resolveComponent("AppIcon")
      const _component_ClientOnly = _resolveComponent("ClientOnly")

      _push(\`<div\${_ssrRenderAttrs(_attrs)}>\`)
      _push(_ssrRenderComponent(_component_AppIcon, { name: "caret-left" }, null, _parent))
      _push(_ssrRenderComponent(_component_ClientOnly, null, {
        default: _withCtx((_, _push, _parent, _scopeId) => {
          if (_push) {
            _push(\`<span\${_scopeId}>TEST</span>\`)
            _push(_ssrRenderComponent(_component_AppIcon, { name: "caret-up" }, null, _parent, _scopeId))
          } else {
            return [
              _createVNode("span", null, "TEST"),
              _createVNode(_component_AppIcon, { name: "caret-up" })
            ]
          }
        }),
        _: 1 /* STABLE */
      }, _parent))
      _push(\`</div>\`)
    }`)

    expect(treeshaken).toContain('resolveComponent("AppIcon")')
    expect(treeshaken).not.toContain('caret-up')
  })
})
