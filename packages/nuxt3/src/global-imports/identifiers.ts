const identifiers = {
  '#app': [
    'useAsyncData',
    'asyncData',
    'defineNuxtComponent',
    'useNuxt',
    'defineNuxtPlugin'
  ],
  '#meta': [
    'useMeta'
  ],
  vue: [
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

export const defaultIdentifiers = {}
for (const pkg in identifiers) {
  for (const id of identifiers[pkg]) {
    defaultIdentifiers[id] = pkg
  }
}
