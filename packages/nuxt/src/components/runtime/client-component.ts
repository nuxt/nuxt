import { getCurrentInstance, h, onMounted, provide, ref } from 'vue'
import type { AsyncComponentLoader, ComponentOptions } from 'vue'
import { isPromise } from '@vue/shared'
import { useNuxtApp } from '#app/nuxt'
import ServerPlaceholder from '#app/components/server-placeholder'
import { clientOnlySymbol } from '#app/components/client-only'

/* @__NO_SIDE_EFFECTS__ */
export async function createClientPage (loader: AsyncComponentLoader) {
  // vue-router: Write "() => import('./MyPage.vue')" instead of "defineAsyncComponent(() => import('./MyPage.vue'))".
  const m = await loader()
  const c = m.default || m
  if (import.meta.dev) {
    // mark component as client-only for `definePageMeta`
    c.__clientOnlyPage = true
  }
  return pageToClientOnly(c)
}

const cache = new WeakMap()

function pageToClientOnly<T extends ComponentOptions> (component: T) {
  if (import.meta.server) {
    return ServerPlaceholder
  }

  if (cache.has(component)) {
    return cache.get(component)
  }

  const clone = { ...component }

  if (clone.render) {
    // override the component render (non script setup component) or dev mode
    clone.render = (ctx: any, cache: any, $props: any, $setup: any, $data: any, $options: any) => ($setup.mounted$ ?? ctx.mounted$)
      ? h(component.render?.bind(ctx)(ctx, cache, $props, $setup, $data, $options))
      : h('div')
  } else {
    // handle runtime-compiler template
    clone.template &&= `
      <template v-if="mounted$">${component.template}</template>
      <template v-else><div></div></template>
    `
  }

  clone.setup = (props, ctx) => {
    const nuxtApp = useNuxtApp()
    const mounted$ = ref(nuxtApp.isHydrating === false)
    provide(clientOnlySymbol, true)
    const vm = getCurrentInstance()
    if (vm) {
      vm._nuxtClientOnly = true
    }
    onMounted(() => {
      mounted$.value = true
    })
    const setupState = component.setup?.(props, ctx) || {}
    if (isPromise(setupState)) {
      return Promise.resolve(setupState).then((setupState: any) => {
        if (typeof setupState !== 'function') {
          setupState ||= {}
          setupState.mounted$ = mounted$
          return setupState
        }
        return (...args: any[]) => (mounted$.value || !nuxtApp.isHydrating) ? h(setupState(...args)) : h('div')
      })
    } else {
      return typeof setupState === 'function'
        ? (...args: any[]) => (mounted$.value || !nuxtApp.isHydrating)
            ? h(setupState(...args))
            : h('div')
        : Object.assign(setupState, { mounted$ })
    }
  }

  cache.set(component, clone)

  return clone
}
