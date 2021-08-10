const VueAPIs = [
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

const nuxtComposition = [
  'useAsyncData',
  'asyncData',
  'defineNuxtComponent',
  'useNuxt',
  'defineNuxtPlugin',
  'useMeta'
]

export const defaultIdentifiers = Object.fromEntries([
  ...VueAPIs.map(name => [name, 'vue']),
  ...nuxtComposition.map(name => [name, '@nuxt/app'])
])
