import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import * as VueCompilerSFC from 'vue/compiler-sfc'
import type { Plugin } from 'vite'
import { Parser } from 'acorn'
import type { Options } from '@vitejs/plugin-vue'
import _vuePlugin from '@vitejs/plugin-vue'
import { TreeShakeTemplatePlugin } from '../src/components/tree-shake'
import { fixtureDir, normalizeLineEndings } from './utils'

vi.mock('node:crypto', () => ({
  update: vi.fn().mockReturnThis(),
  digest: vi.fn().mockReturnValue('one-hash-to-rule-them-all'),
  createHash: vi.fn().mockReturnThis()
}))

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
    configureDevServer () {}
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
      mode: 'client'
    }, {
      pascalName: 'DotClientComponent',
      kebabName: 'dot-client-component',
      export: 'default',
      filePath: 'dummypath',
      shortPath: 'dummypath',
      chunkName: '123',
      prefetch: false,
      preload: false,
      mode: 'client'
    }]
  }
}, { framework: 'rollup' }) as Plugin

const treeshake = async (source: string): Promise<string> => {
  const result = await (treeshakeTemplatePlugin.transform! as Function).call({
    parse: (code: string, opts: any = {}) => Parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ...opts
    })
  }, source)
  return typeof result === 'string' ? result : result?.code
}

async function SFCCompile (name: string, source: string, options: Options, ssr = false): Promise<string> {
  const result = await (vuePlugin({
    compiler: VueCompilerSFC,
    ...options
  }).transform! as Function).call({
    parse: (code: string, opts: any = {}) => Parser.parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
      ...opts
    })
  }, source, name, {
    ssr
  })

  return typeof result === 'string' ? result : result?.code
}

const stateToTest: {name: string, options: Partial<Options & {devServer: {config: {server: any}}}> }[] = [
  {
    name: 'prod',
    options: {
      isProduction: true
    }
  },
  {
    name: 'dev',
    options: {
      isProduction: false,
      devServer: {
        config: {
          // trigger dev behavior
          server: false
        }
      }
    }
  }
]

describe('treeshake client only in ssr', () => {
  vi.spyOn(process, 'cwd').mockImplementation(() => '')
  for (const [index, state] of stateToTest.entries()) {
    it(`should treeshake ClientOnly correctly in ${state.name}`, async () => {
      // add index to avoid using vite vue plugin cache
      const clientResult = await SFCCompile(`SomeComponent${index}.vue`, WithClientOnly, state.options)

      const ssrResult = await SFCCompile(`SomeComponent${index}.vue`, WithClientOnly, state.options, true)

      const treeshaken = await treeshake(ssrResult)
      const [_, scopeId] = clientResult.match(/_pushScopeId\("(.*)"\)/)!

      // ensure the id is correctly passed between server and client
      expect(clientResult).toContain(`pushScopeId("${scopeId}")`)
      expect(treeshaken).toContain(`<div ${scopeId}>`)

      expect(clientResult).toContain('should-be-treeshaken')
      expect(treeshaken).not.toContain('should-be-treeshaken')

      expect(treeshaken).not.toContain("import HelloWorld from '../HelloWorld.vue'")
      expect(clientResult).toContain("import HelloWorld from '../HelloWorld.vue'")

      expect(treeshaken).not.toContain("import { Treeshaken } from 'somepath'")
      expect(clientResult).toContain("import { Treeshaken } from 'somepath'")

      // remove resolved import
      expect(treeshaken).not.toContain('const _component_ResolvedImport =')
      expect(clientResult).toContain('const _component_ResolvedImport =')

      // treeshake multi line variable declaration
      expect(clientResult).toContain('const SomeIsland = defineAsyncComponent(async () => {')
      expect(treeshaken).not.toContain('const SomeIsland = defineAsyncComponent(async () => {')
      expect(treeshaken).not.toContain("return (await import('./../some.island.vue'))")
      expect(treeshaken).toContain('const NotToBeTreeShaken = defineAsyncComponent(async () => {')

      // treeshake object and array declaration
      expect(treeshaken).not.toContain("const { ObjectPattern } = await import('nuxt.com')")
      expect(treeshaken).not.toContain("const { ObjectPattern: ObjectPatternDeclaration } = await import('nuxt.com')")
      expect(treeshaken).toContain('const {  ButShouldNotBeTreeShaken } = defineAsyncComponent(async () => {')
      expect(treeshaken).toContain('const [ { Dont, }, That] = defineAsyncComponent(async () => {')

      // treeshake object that has an assignement pattern
      expect(treeshaken).toContain('const { woooooo, } = defineAsyncComponent(async () => {')
      expect(treeshaken).not.toContain('const { Deep, assignment: { Pattern = ofComponent } } = defineAsyncComponent(async () => {')

      // expect no empty ObjectPattern on treeshaking
      expect(treeshaken).not.toContain('const {  } = defineAsyncComponent')
      expect(treeshaken).not.toContain('import {  } from')

      // expect components used in setup to not be removed
      expect(treeshaken).toContain("import DontRemoveThisSinceItIsUsedInSetup from './ComponentWithProps.vue'")

      // expect import of ClientImport to be treeshaken but not Glob since it is also used outside <ClientOnly>
      expect(treeshaken).not.toContain('ClientImport')
      expect(treeshaken).toContain('import { Glob, } from \'#components\'')

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
      expect(treeshaken).toMatchSnapshot()
    })
  }
})
