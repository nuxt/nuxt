import { installModule, useNuxt } from '@nuxt/kit'
import autoImports from '../../nuxt3/src/auto-imports/module'

// TODO: implement these: https://github.com/nuxt/framework/issues/549
const disabled = [
  'useAsyncData',
  'asyncData'
]

const identifiers = {
  '#app': [
    'defineNuxtComponent',
    'useNuxtApp',
    'defineNuxtPlugin',
    'useRoute',
    'useRouter',
    'useRuntimeConfig'
  ],
  '#meta': [
    'useMeta'
  ],
  '@vue/composition-api': [
    // lifecycle
    'onActivated',
    'onBeforeMount',
    'onBeforeUnmount',
    'onBeforeUpdate',
    'onDeactivated',
    'onErrorCaptured',
    'onMounted',
    'onServerPrefetch',
    'onUnmounted',
    'onUpdated',

    // reactivity,
    'computed',
    'customRef',
    'isReadonly',
    'isRef',
    'markRaw',
    'reactive',
    'readonly',
    'ref',
    'shallowReactive',
    'shallowReadonly',
    'shallowRef',
    'toRaw',
    'toRef',
    'toRefs',
    'triggerRef',
    'unref',
    'watch',
    'watchEffect',

    // component
    'defineComponent',
    'defineAsyncComponent',
    'getCurrentInstance',
    'h',
    'inject',
    'nextTick',
    'provide',
    'useCssModule'
  ]
}

const defaultIdentifiers = {}
for (const pkg in identifiers) {
  for (const id of identifiers[pkg]) {
    defaultIdentifiers[id] = pkg
  }
}

export async function setupAutoImports () {
  const nuxt = useNuxt()
  nuxt.options.autoImports = nuxt.options.autoImports || {}
  nuxt.options.autoImports.disabled = nuxt.options.autoImports.disabled || disabled
  nuxt.options.autoImports.identifiers = Object.assign({}, defaultIdentifiers, nuxt.options.autoImports.identifiers)
  await installModule(nuxt, autoImports)
}
