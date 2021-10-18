import defu from 'defu'
import { computed, getCurrentInstance as getVM, isReactive, isRef, onBeforeMount, onServerPrefetch, reactive, ref, set, shallowRef, toRaw, toRefs, watch } from '@vue/composition-api'
import { useNuxtApp } from './app'
import { useState } from './composables'

// Vue composition API export
export {
  computed,
  createApp,
  createRef,
  customRef,
  defineAsyncComponent,
  del,
  effectScope,
  getCurrentInstance,
  getCurrentScope,
  h,
  inject,
  isRaw,
  isReactive,
  isReadonly,
  isRef,
  markRaw,
  nextTick,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onScopeDispose,
  onServerPrefetch,
  onUnmounted,
  onUpdated,
  provide,
  proxyRefs,
  reactive,
  readonly,
  set,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  toRaw,
  toRef,
  toRefs,
  triggerRef,
  unref,
  useAttrs,
  useCssModule,
  useCSSModule,
  useSlots,
  version,
  warn,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect
} from '@vue/composition-api'

export { ref }

// Common deprecation utils
// TODO: Add migration guide docs to @nuxtjs/composition-api
const checkDocsMsg = 'Please see https://v3.nuxtjs.org for more information.'
const msgPrefix = '[bridge] [legacy capi]'
const unsupported = message => () => { throw new Error(`${msgPrefix} ${message} ${checkDocsMsg}`) }
const _warned = {}
const warnOnce = (id, message) => {
  if (!_warned[id]) {
    console.warn(msgPrefix, message)
    _warned[id] = true
  }
}

// Warn in case of having any imports from `@nuxtjs/composition-api`
warnOnce('import', `\`@nuxtjs/composition-api\` is deprecated. ${checkDocsMsg}`)

// Stub functions that provided type support
export const defineNuxtMiddleware = mw => mw
export const defineNuxtPlugin = unsupported('You are using `defineNuxtPlugin`, which can be replaced with `defineNuxtPlugin` from `@nuxt/bridge`.')

// Internal exports
export const setMetaPlugin = unsupported('`setMetaPlugin` is an internal function that is no longer used.')
export const setSSRContext = unsupported('`setSSRContext` is an internal function that is no longer used.')
export const globalPlugin = unsupported('`globalPlugin` is an internal function that is no longer used.')

// Deprecated functions
export const withContext = unsupported('`withContext` is a deprecated method that is no longer provided.')
export const useStatic = unsupported('`useStatic` is a deprecated method that is no longer provided.')
export const reqRef = unsupported('`reqRef` is a deprecated method that is no longer provided.')
export const reqSsrRef = unsupported('`reqSsrRef` is no longer provided (`ssrRef` can be used instead).')

// ssrRef helpers
const sanitise = val => (val && JSON.parse(JSON.stringify(val))) || val
const getValue = val => val instanceof Function ? val() : val

export const ssrRef = (value, key) => {
  const vm = getVM()
  if (!vm) { throw new Error('ssrRef no longer supports global/ambient context and must be called within a setup() function') }

  warnOnce('ssrRef', '`ssrRef` is deprecated and can be replaced with `useState`.')

  return useState(key, value instanceof Function ? value : () => value)
}

export const shallowSsrRef = (value, key) => {
  warnOnce('shallowSsrRef', '`shallowSsrRef` is deprecated and can be replaced with `useState`.')

  const ref = ssrRef(value, key)

  if (process.client) {
    return shallowRef(ref.value)
  }

  return ref
}

export const ssrPromise = (value, key) => {
  warnOnce('ssrPromise', 'ssrPromise is deprecated. Please use an alternative implementation.')

  const ssrRefs = useSSRRefs()
  const promise = Promise.resolve(isHMR() ? getValue(value) : ssrRefs[key] ?? getValue(value))

  onServerPrefetch(async () => { ssrRefs[key] = sanitise(await promise) })
  return promise
}

// Composition API functions
export const onGlobalSetup = (fn) => {
  warnOnce('onGlobalSetup', '`onGlobalSetup` is deprecated and can be replaced with `defineNuxtPlugin` and `nuxt.provide`.')
  const app = useNuxtApp()
  app._setupFns.push(fn)
}

export const useAsync = (cb, key) => {
  warnOnce('useAsync', 'You are using `useAsync`, which can be replaced with `useAsyncData` from `@nuxt/bridge`.')

  const _ref = isRef(key) ? key : ssrRef(null, key)

  if (!_ref.value || isHMR()) {
    const p = Promise.resolve(cb()).then(res => (_ref.value = res))
    onServerPrefetch(() => p)
  }

  return _ref
}

export const useContext = () => {
  warnOnce('useContext', 'You are using `useContext`, which can be replaced with `useNuxtApp` from `@nuxt/bridge`.')

  const route = useRoute()
  const nuxt = useNuxtApp()

  return {
    ...nuxt.nuxt2App.context,
    route: computed(() => route),
    query: computed(() => route.value.query),
    from: computed(() => nuxt.nuxt2App.context.from),
    params: computed(() => route.value.params)
  }
}

function createEmptyMeta () {
  return {
    titleTemplate: null,

    __dangerouslyDisableSanitizers: [],
    __dangerouslyDisableSanitizersByTagID: {},

    title: undefined,
    htmlAttrs: {},
    headAttrs: {},
    bodyAttrs: {},

    base: undefined,

    meta: [],
    link: [],
    style: [],
    script: [],
    noscript: [],

    changed: undefined,
    afterNavigation: undefined
  }
}

export const getHeadOptions = (options) => {
  const head = function () {
    const optionHead =
      options.head instanceof Function ? options.head.call(this) : options.head

    if (!this._computedHead) { return optionHead }

    const computedHead = this._computedHead.map((h) => {
      if (isReactive(h)) { return toRaw(h) }
      if (isRef(h)) { return h.value }
      return h
    })
    return defu({}, ...computedHead.reverse(), optionHead)
  }

  return { head }
}

export const defineComponent = (options) => {
  if (!('head' in options)) { return options }

  return {
    ...options,
    ...getHeadOptions(options)
  }
}

export const useMeta = (init) => {
  const vm = getCurrentInstance()
  const refreshMeta = () => vm.$meta().refresh()

  if (!vm._computedHead) {
    const metaRefs = reactive(createEmptyMeta())
    vm._computedHead = [metaRefs]
    vm._metaRefs = toRefs(metaRefs)

    if (process.client) {
      watch(Object.values(vm._metaRefs), refreshMeta, { immediate: true })
    }
  }

  if (init) {
    const initRef = init instanceof Function ? computed(init) : ref(init)
    vm._computedHead.push(initRef)

    if (process.client) {
      watch(initRef, refreshMeta, { immediate: true })
    }
  }

  return vm._metaRefs
}

// Wrapped properties
export const wrapProperty = (property, makeComputed = true) => () => {
  const vm = getCurrentInstance()
  return makeComputed ? computed(() => vm[property]) : vm[property]
}

export const useRouter = () => {
  warnOnce('useRouter', 'You are using `useRouter`, which can be replaced with `useRouter` from `@nuxt/bridge`.')
  return getCurrentInstance().$router
}

export const useRoute = () => {
  warnOnce('useRoute', 'You are using `useRoute`, which can be replaced with `useRoute` from `@nuxt/bridge`.')
  const vm = getCurrentInstance()
  return computed(() => vm.$route)
}

export const useStore = () => getCurrentInstance().$store

// useFetch and helper functions

const fetches = new WeakMap()
const fetchPromises = new Map()

const mergeDataOnMount = (data) => {
  const vm = getCurrentInstance()
  if (!vm) { throw new Error('This must be called within a setup function.') }

  onBeforeMount(() => {
    // Merge data
    for (const key in data) {
      try {
        // Assign missing properties
        if (key in vm) {
          // Skip functions (not stringifiable)
          if (typeof vm[key] === 'function') { continue }
          // Preserve reactive objects
          if (isReactive(vm[key])) {
            // Unset keys that do not exist in incoming data
            for (const k in vm[key]) {
              if (!(k in data[key])) {
                delete vm[key][k]
              }
            }
            Object.assign(vm[key], data[key])
            continue
          }
        }
        set(vm, key, data[key])
      } catch (e) {
        if (process.env.NODE_ENV === 'development')
          // eslint-disable-next-line
          console.warn(`Could not hydrate ${key}.`)
      }
    }
  })
}

function createGetCounter (counterObject, defaultKey = '') {
  return function getCounter (id = defaultKey) {
    if (counterObject[id] === undefined) {
      counterObject[id] = 0
    }
    return counterObject[id]++
  }
}

const setFetchState = (vm) => {
  vm.$fetchState =
    vm.$fetchState ||
    reactive({
      error: null,
      pending: false,
      timestamp: 0
    })
}

function getKey (vm) {
  const nuxt = useNuxtApp()
  const nuxtState = nuxt.payload
  if (process.server && 'push' in vm.$ssrContext.nuxt.fetch) {
    return undefined
  } else if (process.client && '_payloadFetchIndex' in nuxtState) {
    nuxtState._payloadFetchIndex = nuxtState._payloadFetchIndex || 0
    return nuxtState._payloadFetchIndex++
  }
  const defaultKey = vm.$options._scopeId || vm.$options.name || ''
  const getCounter = createGetCounter(
    process.server
      ? vm.$ssrContext.fetchCounters
      : nuxt.vue2App._fetchCounters,
    defaultKey
  )

  if (typeof vm.$options.fetchKey === 'function') {
    return vm.$options.fetchKey.call(vm, getCounter)
  } else {
    const key = typeof vm.$options.fetchKey === 'string' ? vm.$options.fetchKey : defaultKey
    return key ? key + ':' + getCounter(key) : String(getCounter(key))
  }
}

function normalizeError (err) {
  let message
  if (!(err.message || typeof err === 'string')) {
    try {
      message = JSON.stringify(err, null, 2)
    } catch (e) {
      message = `[${err.constructor.name}]`
    }
  } else {
    message = err.message || err
  }
  return {
    ...err,
    message,
    statusCode:
      err.statusCode ||
      err.status ||
      (err.response && err.response.status) ||
      500
  }
}

const loadFullStatic = (vm) => {
  vm._fetchKey = getKey(vm)
  // Check if component has been fetched on server
  const { fetchOnServer } = vm.$options
  const fetchedOnServer =
    typeof fetchOnServer === 'function'
      ? fetchOnServer.call(vm) !== false
      : fetchOnServer !== false

  if (!fetchedOnServer || vm.$nuxt?.isPreview || !vm.$nuxt?._pagePayload) {
    return
  }
  vm._hydrated = true
  const data = vm.$nuxt._pagePayload.fetch[vm._fetchKey]

  // If fetch error
  if (data && data._error) {
    vm.$fetchState.error = data._error
    return
  }

  mergeDataOnMount(data)
}

async function serverPrefetch (vm) {
  if (!vm._fetchOnServer) { return }

  // Call and await on $fetch
  setFetchState(vm)

  try {
    await callFetches.call(vm)
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    vm.$fetchState.error = normalizeError(err)
  }
  vm.$fetchState.pending = false

  // Define an ssrKey for hydration
  vm._fetchKey =
    // Nuxt 2.15+ uses a different format - an object rather than an array
    'push' in vm.$ssrContext.nuxt.fetch
      ? vm.$ssrContext.nuxt.fetch.length
      : vm._fetchKey || vm.$ssrContext.fetchCounters['']++

  // Add data-fetch-key on parent element of Component
  if (!vm.$vnode.data) { vm.$vnode.data = {} }
  const attrs = (vm.$vnode.data.attrs = vm.$vnode.data.attrs || {})
  attrs['data-fetch-key'] = vm._fetchKey

  const data = { ...vm._data }
  Object.entries(vm.__composition_api_state__.rawBindings).forEach(
    ([key, val]) => {
      if (val instanceof Function || val instanceof Promise) { return }

      data[key] = isRef(val) ? val.value : val
    }
  )

  // Add to ssrContext for window.__NUXT__.fetch
  const content = vm.$fetchState.error
    ? { _error: vm.$fetchState.error }
    : JSON.parse(JSON.stringify(data))
  if ('push' in vm.$ssrContext.nuxt.fetch) {
    vm.$ssrContext.nuxt.fetch.push(content)
  } else {
    vm.$ssrContext.nuxt.fetch[vm._fetchKey] = content
  }
}

async function callFetches () {
  const fetchesToCall = fetches.get(this)
  if (!fetchesToCall) { return }
  this.$nuxt.nbFetching++

  this.$fetchState.pending = true
  this.$fetchState.error = null
  this._hydrated = false

  let error = null
  const startTime = Date.now()

  try {
    await Promise.all(
      fetchesToCall.map((fetch) => {
        if (fetchPromises.has(fetch)) { return fetchPromises.get(fetch) }
        const promise = Promise.resolve(fetch(this)).finally(() =>
          fetchPromises.delete(fetch)
        )
        fetchPromises.set(fetch, promise)
        return promise
      })
    )
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    error = normalizeError(err)
  }

  const delayLeft = (this._fetchDelay || 0) - (Date.now() - startTime)
  if (delayLeft > 0) {
    await new Promise(resolve => setTimeout(resolve, delayLeft))
  }

  this.$fetchState.error = error
  this.$fetchState.pending = false
  this.$fetchState.timestamp = Date.now()

  this.$nextTick(() => (this.$nuxt).nbFetching--)
}

const isSsrHydration = vm => vm.$vnode?.elm?.dataset?.fetchKey

export const useFetch = (callback) => {
  const vm = getCurrentInstance()
  const nuxt = useNuxtApp()

  const nuxtState = nuxt.payload

  const callbacks = fetches.get(vm) || []
  fetches.set(vm, [...callbacks, callback])

  if (typeof vm.$options.fetchOnServer === 'function') {
    vm._fetchOnServer = vm.$options.fetchOnServer.call(vm) !== false
  } else {
    vm._fetchOnServer = vm.$options.fetchOnServer !== false
  }

  if (process.server) {
    vm._fetchKey = getKey(vm)
  }

  setFetchState(vm)

  onServerPrefetch(() => serverPrefetch(vm))

  function result () {
    return {
      fetch: vm.$fetch,
      fetchState: vm.$fetchState
    }
  }

  vm._fetchDelay =
    typeof vm.$options.fetchDelay === 'number' ? vm.$options.fetchDelay : 0

  vm.$fetch = callFetches.bind(vm)

  onBeforeMount(() => !vm._hydrated && callFetches.call(vm))

  if (process.server || !isSsrHydration(vm)) {
    if (process.client && !process.dev && process.static) { loadFullStatic(vm) }
    return result()
  }

  // Hydrate component
  vm._hydrated = true
  vm._fetchKey = vm.$vnode.elm?.dataset.fetchKey || getKey(vm)
  const data = nuxtState.fetch[vm._fetchKey]

  // If fetch error
  if (data && data._error) {
    vm.$fetchState.error = data._error
    return result()
  }

  mergeDataOnMount(data)

  return result()
}

// -- Private shared utils (across composables) --

function getCurrentInstance () {
  const vm = getVM()
  if (!vm) { throw new Error('This must be called within a setup function.') }
  return vm.proxy
}

const useSSRRefs = () => {
  const { payload } = useNuxtApp()
  payload.ssrRefs = payload.ssrRefs || {}
  return payload.ssrRefs
}

const isHMR = () => process.env.NODE_ENV === 'development' && process.client && window.$nuxt?.context.isHMR
