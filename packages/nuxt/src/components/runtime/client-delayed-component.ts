import { createStaticVNode, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, Ref } from 'vue'
// import ClientOnly from '#app/components/client-only'
import { useObserver } from '#app/utils'
import { getFragmentHTML } from '#app/components/utils'
import { useNuxtApp } from '#app/nuxt'

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      let vnode: string | null = null
      if (import.meta.client && nuxt.isHydrating) {
        vnode = createStaticVNode(getFragmentHTML(instance.vnode.el), 1)
      }
      const isIntersecting = ref(false)
      const el: Ref<Element | null> = ref(null)
      let unobserve: (() => void) | null = null
      onMounted(() => {
        const observer = useObserver()
        unobserve = observer!.observe(el.value as Element, () => {
          isIntersecting.value = true
          unobserve?.()
          unobserve = null
        })
      })
      onBeforeUnmount(() => {
        unobserve?.()
        unobserve = null
      })
      return () => h('div', { ref: el }, [
        isIntersecting.value ? h(componentLoader, attrs) : vnode,
      ])
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      let vnode: string | null = null
      if (import.meta.client && nuxt.isHydrating) {
        vnode = createStaticVNode(getFragmentHTML(instance.vnode.el), 1)
      }
      const isIdle = ref(false)
      let idleHandle: number | null = null
      onMounted(() => {
        idleHandle = requestIdleCallback(() => {
          isIdle.value = true
          cancelIdleCallback(idleHandle as unknown as number)
          idleHandle = null
        })
      })
      onBeforeUnmount(() => {
        if (idleHandle) {
          cancelIdleCallback(idleHandle as unknown as number)
          idleHandle = null
        }
      })
      return () => isIdle.value ? h(componentLoader, attrs) : vnode
    },
  })
}
