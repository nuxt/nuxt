import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { parseSync } from 'rolldown/utils'
import * as VueFunctions from 'vue'
import type { Import, Unimport } from 'unimport'
import { createUnimport, scanDirExports } from 'unimport'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { registry as scriptRegistry } from '@nuxt/scripts/registry'
import { TransformPlugin, getImportsSignature } from '../src/imports/transform.ts'
import { defaultPresets, scriptsStubsPreset } from '../src/imports/presets.ts'
import { loadNuxt } from '../src/index.ts'
import importsModule from '../src/imports/module.ts'

describe('imports:transform', () => {
  const imports: Import[] = [
    { name: 'ref', as: 'ref', from: 'vue' },
    { name: 'computed', as: 'computed', from: 'bar' },
    { name: 'foo', as: 'foo', from: 'excluded' },
  ]

  const ctx = createUnimport({
    injectAtEnd: true,
    parser: 'oxc',
    imports,
  })

  const transformPlugin = TransformPlugin({ ctx, options: { transform: { exclude: [/node_modules/] } } }).raw({}, { framework: 'rollup', versions: {} }) as Plugin
  const transform = async (source: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const result = await (transformPlugin.transform! as Function).call({ error: null, warn: null } as any, source, '')
    return typeof result === 'string' ? result : result?.code
  }

  it('should correct inject', async () => {
    expect(await transform('const a = ref(0)')).toMatchInlineSnapshot('"import { ref } from \'vue\';\nconst a = ref(0)"')
  })

  it('should ignore existing imported', async () => {
    expect(await transform('import { ref } from "foo"; const a = ref(0)')).to.equal(undefined)
    expect(await transform('import { computed as ref } from "foo"; const a = ref(0)')).to.equal(undefined)
    expect(await transform('import ref from "foo"; const a = ref(0)')).to.equal(undefined)
    expect(await transform('import { z as ref } from "foo"; const a = ref(0)')).to.equal(undefined)
    expect(await transform('let ref = () => {}; const a = ref(0)')).to.equal(undefined)
    expect(await transform('let { ref } = Vue; const a = ref(0)')).to.equal(undefined)
    expect(await transform('let [\ncomputed,\nref\n] = Vue; const a = ref(0); const b = ref(0)')).to.equal(undefined)
  })

  it('should inject when a local variable of the same name is declared in a nested scope', async () => {
    expect(await transform('const a = ref(0); function foo () { const ref = 1; return ref }')).toMatchInlineSnapshot('"import { ref } from \'vue\';\nconst a = ref(0); function foo () { const ref = 1; return ref }"')
  })

  it('should ignore comments', async () => {
    const result = await transform('// import { computed } from "foo"\n;const a = computed(0)')
    expect(result).toMatchInlineSnapshot(`
      "import { computed } from 'bar';
      // import { computed } from "foo"
      ;const a = computed(0)"
    `)
  })

  it('should exclude files from transform', async () => {
    expect(await transform('excluded')).toEqual(undefined)
  })

  it('should include files matching a global pattern on every check', async () => {
    const plugin = TransformPlugin({ ctx, options: { autoImport: true, transform: { include: [/\.custom$/g] } } }).raw({}, { framework: 'rollup', versions: {} }) as Plugin & { transformInclude: (id: string) => boolean }
    const id = '/node_modules/pkg/example.custom'
    expect(plugin.transformInclude(id)).toBe(true)
    expect(plugin.transformInclude(id)).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const result = await (plugin.transform! as Function).call({ error: null, warn: null } as any, 'const a = ref(0)', id)
    expect(result?.code).toContain('import { ref } from \'vue\'')
  })
})

describe('imports:options', () => {
  it('should force transforms only for files inside the build directory', async () => {
    const options = await importsModule.getOptions!({}, { options: { buildDir: '/project/.nuxt' } } as unknown as Nuxt)
    const include = options.transform!.include!

    expect(include.some(pattern => pattern.test('/project/.nuxt/components.plugin.mjs'))).toBe(true)
    expect(include.some(pattern => pattern.test('/project/.nuxt-foo/components.plugin.mjs'))).toBe(false)
  })
})

const excludedNuxtHelpers = ['useHydration', 'useHead', 'useSeoMeta', 'useServerSeoMeta', 'useId']

describe('imports:nuxt', () => {
  it('should register every composable globally', () => {
    const entrypointPath = fileURLToPath(new URL('../src/app/composables/index.ts', import.meta.url))
    const { module } = parseSync(entrypointPath, readFileSync(entrypointPath, 'utf8'))
    const names = module.staticExports.flatMap(statement => statement.entries.filter(entry => !entry.isType).map(entry => entry.exportName.name).filter((name): name is string => !!name))
    const registered = new Set(defaultPresets.flatMap(a => a.from.startsWith('#app/') ? a.imports : []))

    expect(names.length).toBeGreaterThan(0)
    expect(names.filter(name => !excludedNuxtHelpers.includes(name) && !registered.has(name))).toEqual([])
  })
})

const excludedVueHelpers = [
  // Already globally registered
  'defineEmits',
  'defineExpose',
  'defineModel',
  'defineOptions',
  'defineProps',
  'defineSlots',
  'withDefaults',
  'stop',
  //
  '__esModule',
  'devtools',
  'EffectScope',
  'ReactiveEffect',
  'stop',
  'assertNumber',
  'camelize',
  'capitalize',
  'normalizeClass',
  'normalizeProps',
  'normalizeStyle',
  'toDisplayString',
  'toHandlerKey',
  'BaseTransition',
  'BaseTransitionPropsValidators',
  'Comment',
  'Fragment',
  'KeepAlive',
  'Static',
  'Suspense',
  'Teleport',
  'Text',
  'callWithAsyncErrorHandling',
  'callWithErrorHandling',
  'cloneVNode',
  'compatUtils',
  'createBlock',
  'createCommentVNode',
  'createElementBlock',
  'createElementVNode',
  'createHydrationRenderer',
  'createPropsRestProxy',
  'createRenderer',
  'createSlots',
  'createStaticVNode',
  'createTextVNode',
  'createVNode',
  'getTransitionRawChildren',
  'guardReactiveProps',
  'handleError',
  'initCustomFormatter',
  'isMemoSame',
  'isRuntimeOnly',
  'isVNode',
  'mergeDefaults',
  'mergeModels',
  'mergeProps',
  'openBlock',
  'popScopeId',
  'pushScopeId',
  'queuePostFlushCb',
  'registerRuntimeCompiler',
  'renderList',
  'renderSlot',
  'resolveComponent',
  'resolveDirective',
  'resolveDynamicComponent',
  'resolveFilter',
  'resolveTransitionHooks',
  'setBlockTracking',
  'setDevtoolsHook',
  'setTransitionHooks',
  'ssrContextKey',
  'ssrUtils',
  'toHandlers',
  'transformVNodeArgs',
  'useSSRContext',
  'version',
  'warn',
  'watchPostEffect',
  'watchSyncEffect',
  'withAsyncContext',
  'Transition',
  'TransitionGroup',
  'VueElement',
  'ErrorTypeStrings',
  'createApp',
  'createSSRApp',
  'defineCustomElement',
  'defineSSRCustomElement',
  'hydrate',
  'initDirectivesForSSR',
  'render',
  'vModelCheckbox',
  'vModelDynamic',
  'vModelRadio',
  'vModelSelect',
  'vModelText',
  'vShow',
  'compile',
  'DeprecationTypes',
  'ErrorCodes',
  'TrackOpTypes',
  'TriggerOpTypes',
  'useHost',
  'hydrateOnVisible',
  'hydrateOnMediaQuery',
  'hydrateOnInteraction',
  'hydrateOnIdle',
  'onWatcherCleanup',
  'getCurrentWatcher',
  'patchProp',
  'nodeOps',
  'MoveType',
  'NULL_DYNAMIC_COMPONENT',
  'VueElementBase',
  'defineVaporAsyncComponent',
  'setIsHydratingEnabled',
  'useInstanceOption',
  'module.exports',
]

describe('imports:vue', () => {
  it('should register every Vue helper globally', () => {
    const registered = new Set(defaultPresets.find(a => a.from === 'vue')!.imports)
    expect(Object.keys(VueFunctions).filter(name => !excludedVueHelpers.includes(name) && !registered.has(name))).toEqual([])
  })
})

describe('imports:nuxt/scripts', async () => {
  const scripts = await scriptRegistry().then(r => r.map(s => s.import?.name).filter(Boolean))
  const globalScripts = new Set([
    'useScript',
    'useScriptEventPage',
    'useScriptTriggerElement',
    'useScriptTriggerConsent',
    // registered separately
    'useScriptGoogleTagManager',
    'useScriptGoogleAnalytics',
  ])
  it('should stub exactly the composables in the @nuxt/scripts registry', () => {
    expect(scriptsStubsPreset.imports.filter(name => !globalScripts.has(name as string) && !scripts.includes(name as string))).toEqual([])
    expect(scripts.filter(name => !scriptsStubsPreset.imports.includes(name!))).toEqual([])
  })
})

describe('imports:hot-update', () => {
  function setup () {
    const version = { current: 0 }
    const plugin = TransformPlugin({
      ctx: createUnimport({ imports: [] }),
      options: {},
      refreshImports: file => file.startsWith('/app/composables/') ? Promise.resolve() : undefined,
      getImportsVersion: () => version.current,
    }).raw({}, { framework: 'vite', versions: {} }) as Plugin & { vite: { hotUpdate: { handler: (this: unknown, ctx: unknown) => Promise<void> } } }
    const invalidated: string[] = []
    const environment = (name: string) => ({ moduleGraph: { invalidateModule: (mod: { id: string }) => invalidated.push(`${name}:${mod.id}`) } })
    const environments = { client: environment('client'), ssr: environment('ssr') }
    const importer = { id: '/app/pages/index.vue' }
    const hotUpdate = (file: string, env: keyof typeof environments = 'client') => plugin.vite.hotUpdate.handler.call({ environment: environments[env] }, { file, modules: [{ importers: new Set([importer]) }] })
    return { hotUpdate, invalidated, version }
  }

  it('keeps importers while the available imports are unchanged', async () => {
    const { hotUpdate, invalidated } = setup()

    await hotUpdate('/app/composables/counter.ts')
    await hotUpdate('/app/composables/counter.ts', 'ssr')
    expect(invalidated).toEqual([])
  })

  it('invalidates the importers of each edited file once the available imports change', async () => {
    const { hotUpdate, invalidated, version } = setup()

    version.current++
    await hotUpdate('/app/composables/counter.ts')
    await hotUpdate('/app/composables/counter.ts', 'ssr')
    expect(invalidated).toEqual(['client:/app/pages/index.vue', 'ssr:/app/pages/index.vue'])

    await hotUpdate('/app/composables/counter.ts')
    expect(invalidated).toHaveLength(2)

    await hotUpdate('/app/composables/other.ts')
    expect(invalidated).toHaveLength(3)

    await hotUpdate('/app/pages/about.vue')
    expect(invalidated).toHaveLength(3)
  })
})

describe('imports:rescan', () => {
  it('drops the exports of a deleted barrel file', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-imports-rescan-'))
    onTestFinished(() => rm(rootDir, { recursive: true, force: true }))
    await mkdir(join(rootDir, 'composables'))
    await mkdir(join(rootDir, 'internal'))
    await writeFile(join(rootDir, 'internal/foo.ts'), 'export const useFoo = () => 1\n')
    await writeFile(join(rootDir, 'composables/index.ts'), 'export * from \'../internal/foo\'\n')

    const nuxt = await loadNuxt({ cwd: rootDir, ready: false, overrides: { srcDir: rootDir, logLevel: 'silent' } })
    onTestFinished(() => nuxt.close())
    let ctx: Unimport | undefined
    nuxt.hook('imports:context', (c) => { ctx = c })
    await nuxt.ready()
    const names = async () => (await ctx!.getImports()).map(i => i.as ?? i.name)
    expect(await names()).toContain('useFoo')

    await rm(join(rootDir, 'composables/index.ts'))
    await nuxt.callHook('builder:watch', 'unlink', 'composables/index.ts')
    expect(await names()).not.toContain('useFoo')
  })
})

describe('imports:signature', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'nuxt-imports-signature-'))
    await mkdir(join(root, 'composables'))
    await mkdir(join(root, 'lib'))
    await writeFile(join(root, 'lib/shared.ts'), 'export const useShared = () => 1\n')
  })
  afterEach(() => rm(root, { recursive: true, force: true }))

  async function signatureOf (code: string) {
    await writeFile(join(root, 'composables/counter.ts'), code)
    return getImportsSignature(await scanDirExports([join(root, 'composables')]))
  }

  it('is unchanged by edits that keep the exports', async () => {
    const signature = await signatureOf('export const useCounter = () => 1\n')
    expect(await signatureOf('/** Counts. */\nexport const useCounter = () => 2\n')).toBe(signature)
  })

  it.each([
    ['a renamed export', 'export const useCount = () => 1\n'],
    ['a default export', 'export default () => 1\n'],
    ['a type export', 'export const useCounter = () => 1\nexport type Counter = number\n'],
    ['a re-export from outside the scanned directory', 'export const useCounter = () => 1\nexport * from \'../lib/shared\'\n'],
  ])('changes with %s', async (_, code) => {
    const signature = await signatureOf('export const useCounter = () => 1\n')
    expect(await signatureOf(code)).not.toBe(signature)
  })
})
