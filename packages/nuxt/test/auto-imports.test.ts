import { readFileSync } from 'node:fs'
import { expect, describe, it } from 'vitest'
import { join } from 'pathe'
import { createCommonJS, findExports } from 'mlly'
import * as VueFunctions from 'vue'
import type { Import } from 'unimport'
import { createUnimport } from 'unimport'
import type { Plugin } from 'vite'
import { TransformPlugin } from '../src/imports/transform'
import { defaultPresets } from '../src/imports/presets'

describe('imports:transform', () => {
  const imports: Import[] = [
    { name: 'ref', as: 'ref', from: 'vue' },
    { name: 'computed', as: 'computed', from: 'bar' },
    { name: 'foo', as: 'foo', from: 'excluded' }
  ]

  const ctx = createUnimport({
    imports
  })

  const transformPlugin = TransformPlugin.raw({ ctx, options: { transform: { exclude: [/node_modules/] } } }, { framework: 'rollup' }) as Plugin
  const transform = async (source: string) => {
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

  it('should ignore comments', async () => {
    const result = await transform('// import { computed } from "foo"\n;const a = computed(0)')
    expect(result).toMatchInlineSnapshot(`
      "import { computed } from 'bar';
      // import { computed } from \\"foo\\"
      ;const a = computed(0)"
    `)
  })

  it('should exclude files from transform', async () => {
    expect(await transform('excluded')).toEqual(undefined)
  })
})

const excludedNuxtHelpers = ['useHydration', 'useHead', 'useSeoMeta', 'useServerSeoMeta']

describe('imports:nuxt', () => {
  try {
    const { __dirname } = createCommonJS(import.meta.url)
    const entrypointContents = readFileSync(join(__dirname, '../src/app/composables/index.ts'), 'utf8')

    const names = findExports(entrypointContents).flatMap(i => i.names || i.name)
    for (let name of names) {
      name = name.replace(/\/\*.*\*\//, '').trim()
      if (excludedNuxtHelpers.includes(name)) {
        continue
      }
      it(`should register ${name} globally`, () => {
        expect(defaultPresets.flatMap(a => a.from === '#app' ? a.imports : [])).to.include(name)
      })
    }
  } catch (e) {
    it('should import composables', () => {
      console.log(e)
      expect(false).toBe(true)
    })
  }
})

const excludedVueHelpers = [
  // Already globally registered
  'defineEmits',
  'defineExpose',
  'defineProps',
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
  'createApp',
  'createSSRApp',
  'defineCustomElement',
  'defineSSRCustomElement',
  'hydrate',
  'initDirectivesForSSR',
  'render',
  'useCssVars',
  'vModelCheckbox',
  'vModelDynamic',
  'vModelRadio',
  'vModelSelect',
  'vModelText',
  'vShow',
  'compile'
]

describe('imports:vue', () => {
  for (const name of Object.keys(VueFunctions)) {
    if (excludedVueHelpers.includes(name)) {
      continue
    }
    it(`should register ${name} globally`, () => {
      expect(defaultPresets.find(a => a.from === 'vue')!.imports).toContain(name)
    })
  }
})
