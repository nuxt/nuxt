import { createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, Ref } from 'vue'
// import ClientOnly from '#app/components/client-only'
import { useObserver } from '#app/utils'
import { getFragmentHTML } from '#app/components/utils'
import { useNuxtApp } from '#app/nuxt'

// todo find a better way to do it ?
function elementIsVisibleInViewport (el: Element) {
  const { top, left, bottom, right } = el.getBoundingClientRect()
  const { innerHeight, innerWidth } = window
  return ((top > 0 && top < innerHeight) ||
    (bottom > 0 && bottom < innerHeight)) &&
    ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyIOClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h('div', {}, [
          h(componentLoader, attrs),
        ])
      }

      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      const isIntersecting = ref(false)
      const el: Ref<Element | null> = ref(null)
      let unobserve: (() => void) | null = null

      // todo can be refactored
      if (instance.vnode.el && nuxt.isHydrating) {
        isIntersecting.value = elementIsVisibleInViewport(instance.vnode.el as Element)
      }

      if (!isIntersecting.value) {
        onMounted(() => {
          const observer = useObserver()
          unobserve = observer!.observe(el.value as Element, () => {
            isIntersecting.value = true
            unobserve?.()
            unobserve = null
          })
        })
      }
      onBeforeUnmount(() => {
        unobserve?.()
        unobserve = null
      })
      return () => {
        return h('div', { ref: el }, [
          isIntersecting.value ? h(componentLoader, attrs) : (instance.vnode.el && nuxt.isHydrating) ? createVNode(createStaticVNode(getFragmentHTML(instance.vnode.el ?? null, true)?.join('') || '', 1)) : null,
        ])
      }
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createLazyNetworkClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h('div', {}, [
          h(componentLoader, attrs),
        ])
      }
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
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
      return () => h('div', {}, [
        isIdle.value ? h(componentLoader, attrs) : (instance.vnode.el && nuxt.isHydrating) ? createVNode(createStaticVNode(getFragmentHTML(instance.vnode.el ?? null, true)?.join('') || '', 1)) : null,
      ])
    },
  })
}
