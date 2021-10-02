import { installModule, useNuxt } from '@nuxt/kit'
import globalImports from '../../nuxt3/src/global-imports/module'

// TODO: implement these: https://github.com/nuxt/framework/issues/549
const disabled = [
  'useMeta',
  'useAsyncData',
  'asyncData'
]

const identifiers = {
  '#app': [
    'defineNuxtComponent',
    'useNuxtApp',
    'defineNuxtPlugin',
    'useRoute',
    'useRouter'
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

export async function setupGlobalImports () {
  const nuxt = useNuxt()
  nuxt.options.globalImports = nuxt.options.globalImports || {}
  nuxt.options.globalImports.disabled = nuxt.options.globalImports.disabled || disabled
  nuxt.options.globalImports.identifiers = Object.assign({}, defaultIdentifiers, nuxt.options.globalImports.identifiers)
  await installModule(nuxt, globalImports)
}
