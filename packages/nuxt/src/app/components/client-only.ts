import { cloneVNode, createElementBlock, defineComponent, getCurrentInstance, h, onMounted, provide, ref } from 'vue'
import type { ComponentInternalInstance, ComponentOptions, InjectionKey } from 'vue'
import { isPromise } from '@vue/shared'
import { useNuxtApp } from '../nuxt'
import ServerPlaceholder from './server-placeholder'
import { elToStaticVNode } from './utils'

export const clientOnlySymbol: InjectionKey<boolean> = Symbol.for('nuxt:client-only')

const STATIC_DIV = '<div></div>'

export default defineComponent({
  name: 'ClientOnly',
  inheritAttrs: false,

  props: ['fallback', 'placeholder', 'placeholderTag', 'fallbackTag'],
  setup (props, { slots, attrs }) {
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    // Bail out of checking for pages/layouts as they might be included under `<ClientOnly>` 🤷‍♂️
    if (import.meta.dev) {
      const nuxtApp = useNuxtApp()
      nuxtApp._isNuxtPageUsed = true
      nuxtApp._isNuxtLayoutUsed = true
    }
    const vm = getCurrentInstance()
    if (vm) {
      vm._nuxtClientOnly = true
    }
    provide(clientOnlySymbol, true)
    return () => {
      if (mounted.value) { return slots.default?.() }
      const slot = slots.fallback || slots.placeholder
      if (slot) { return h(slot) }
      const fallbackStr = props.fallback || props.placeholder || ''
      const fallbackTag = props.fallbackTag || props.placeholderTag || 'span'
      return createElementBlock(fallbackTag, attrs, fallbackStr)
    }
  },
})

const cache = new WeakMap()

/* @__NO_SIDE_EFFECTS__ */
export function createClientOnly<T extends ComponentOptions> (component: T) {
  if (import.meta.server) {
    return ServerPlaceholder
  }
  if (cache.has(component)) {
    return cache.get(component)
  }

  const clone = { ...component }

  if (clone.render) {
    // override the component render (non script setup component) or dev mode
    clone.render = (ctx: any, cache: any, $props: any, $setup: any, $data: any, $options: any) => {
      if ($setup.mounted$ ?? ctx.mounted$) {
        const res = component.render?.bind(ctx)(ctx, cache, $props, $setup, $data, $options)
        return (res.children === null || typeof res.children === 'string')
          ? cloneVNode(res)
          : h(res)
      }
      return elToStaticVNode(ctx._.vnode.el, STATIC_DIV)
    }
  } else {
    // handle runtime-compiler template
    clone.template &&= `
      <template v-if="mounted$">${component.template}</template>
      <template v-else>${STATIC_DIV}</template>
    `
  }

  clone.setup = (props, ctx) => {
    const nuxtApp = useNuxtApp()
    const mounted$ = ref(nuxtApp.isHydrating === false)
    const instance = getCurrentInstance()!

    if (nuxtApp.isHydrating) {
      const attrs = { ...instance.attrs }
      // remove existing directives during hydration
      const directives = extractDirectives(instance)
      // prevent attrs inheritance since a staticVNode is rendered before hydration
      for (const key in attrs) {
        delete instance.attrs[key]
      }

      onMounted(() => {
        Object.assign(instance.attrs, attrs)
        instance.vnode.dirs = directives
      })
    }

    onMounted(() => {
      mounted$.value = true
    })
    const setupState = component.setup?.(props, ctx) || {}

    if (isPromise(setupState)) {
      return Promise.resolve(setupState).then((setupState) => {
        if (typeof setupState !== 'function') {
          setupState ||= {}
          setupState.mounted$ = mounted$
          return setupState
        }
        return (...args: any[]) => {
          if (mounted$.value || !nuxtApp.isHydrating) {
            const res = setupState(...args)
            return (res.children === null || typeof res.children === 'string')
              ? cloneVNode(res)
              : h(res)
          }
          return elToStaticVNode(instance?.vnode.el, STATIC_DIV)
        }
      })
    } else {
      if (typeof setupState === 'function') {
        return (...args: any[]) => {
          if (mounted$.value) {
            return h(setupState(...args), ctx.attrs)
          }
          return elToStaticVNode(instance?.vnode.el, STATIC_DIV)
        }
      }
      return Object.assign(setupState, { mounted$ })
    }
  }

  cache.set(component, clone)

  return clone
}

function extractDirectives (instance: ComponentInternalInstance | null) {
  if (!instance || !instance.vnode.dirs) { return null }
  const directives = instance.vnode.dirs
  instance.vnode.dirs = null
  return directives
}
