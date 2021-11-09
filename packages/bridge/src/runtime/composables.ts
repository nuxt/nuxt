import { getCurrentInstance, onBeforeUnmount, isRef, watch, reactive, toRef, isReactive, Ref } from '@vue/composition-api'
import type { CombinedVueInstance } from 'vue/types/vue'
import type { MetaInfo } from 'vue-meta'
import type VueRouter from 'vue-router'
import type { Route } from 'vue-router'
import { useNuxtApp } from './app'

export * from '@vue/composition-api'

const mock = () => () => { throw new Error('not implemented') }

export const useAsyncData = mock()
export const useHydration = mock()

// Runtime config helper
export const useRuntimeConfig = () => {
  const nuxtApp = useNuxtApp()
  if (!nuxtApp.$config) {
    nuxtApp.$config = reactive(nuxtApp.nuxt2Context.app.$config)
  }
  return nuxtApp.$config
}

// Auto-import equivalents for `vue-router`
export const useRouter = () => {
  return useNuxtApp()?.nuxt2Context.app.router as VueRouter
}

// This provides an equivalent interface to `vue-router` (unlike legacy implementation)
export const useRoute = () => {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp._route) {
    Object.defineProperty(nuxtApp, '__route', {
      get: () => nuxtApp.nuxt2Context.app.context.route
    })
    nuxtApp._route = reactive(nuxtApp.__route)
    const router = useRouter()
    router.afterEach(route => Object.assign(nuxtApp._route, route))
  }

  return nuxtApp._route as Route
}

// payload.state is used for vuex by nuxt 2
export const useState = <T>(key: string, init?: (() => T)): Ref<T> => {
  const nuxtApp = useNuxtApp()
  if (!nuxtApp.payload.useState) {
    nuxtApp.payload.useState = {}
  }
  if (!isReactive(nuxtApp.payload.useState)) {
    nuxtApp.payload.useState = reactive(nuxtApp.payload.useState)
  }
  const state = toRef(nuxtApp.payload.useState, key)
  if (state.value === undefined && init) {
    state.value = init()
  }
  return state
}

type Reffed<T extends Record<string, any>> = {
  [P in keyof T]: T[P] extends Array<infer A> ? Ref<Array<Reffed<A>>> | Array<Reffed<A>> : T[P] extends Record<string, any> ? Reffed<T[P]> | Ref<Reffed<T[P]>> : T[P] | Ref<T[P]>
}

function unwrap (value: any): Record<string, any> {
  if (!value || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') { return value }
  if (Array.isArray(value)) { return value.map(i => unwrap(i)) }
  if (isRef(value)) { return unwrap(value.value) }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, value]) => [key, unwrap(value)]))
  }
  return value
}

type AugmentedComponent = CombinedVueInstance<Vue, object, object, object, Record<never, any>> & {
  _vueMeta?: boolean
  $metaInfo?: MetaInfo
}

export const useNuxt2Meta = (metaOptions: Reffed<MetaInfo> | (() => Reffed<MetaInfo>)) => {
  const vm = getCurrentInstance()!.proxy as AugmentedComponent
  const meta = vm.$meta()
  const $root = vm.$root

  if (!vm._vueMeta) {
    vm._vueMeta = true

    let parent = vm.$parent as AugmentedComponent
    while (parent && parent !== $root) {
      if (parent._vueMeta === undefined) {
        parent._vueMeta = false
      }
      parent = parent.$parent
    }
  }
  // @ts-ignore
  vm.$options.head = vm.$options.head || {}

  const metaSource = metaOptions instanceof Function ? metaOptions : () => metaOptions
  const unwatch = watch(metaSource, (metaInfo: MetaInfo) => {
    vm.$metaInfo = {
      ...vm.$metaInfo || {},
      ...unwrap(metaInfo)
    }
    if (process.client) {
      meta.refresh()
    }
  }, { immediate: true, deep: true })

  onBeforeUnmount(unwatch)
}
