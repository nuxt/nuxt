import { createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, Ref } from 'vue'
// import ClientOnly from '#app/components/client-only'
import type { ObserveFn } from '#app/utils'
import { getFragmentHTML } from '#app/components/utils'
import { useNuxtApp } from '#app/nuxt'
import { cancelIdleCallback, requestIdleCallback } from '#app/compat/idle-callback'
import { onNuxtReady } from '#app'

function useIntersectionObserver (options: IntersectionObserverInit): { observe: ObserveFn } {
  if (import.meta.server) { return { observe: () => () => {} } }

  let observer: IntersectionObserver | null = null

  const observe: ObserveFn = (element, callback) => {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const isVisible = entry.isIntersecting || entry.intersectionRatio > 0
          if (isVisible && callback) { callback() }
        }
      }, options)
    }
    observer.observe(element)
    return () => {
      observer!.unobserve(element)
      observer!.disconnect()
      observer = null
    }
  }

  const _observer = {
    observe,
  }

  return _observer
}

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
        return () => h(componentLoader, attrs)
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
          const observer = useIntersectionObserver(attrs.loader ?? {})
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
        return () => h(componentLoader, attrs)
      }
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      const isIdle = ref(false)
      let idleHandle: number | null = null
      onMounted(() => {
        onNuxtReady(() => {
          idleHandle = requestIdleCallback(() => {
            isIdle.value = true
            cancelIdleCallback(idleHandle as unknown as number)
            idleHandle = null
          }, attrs.loader ?? { timeout: 10000 })
        })
      })
      onBeforeUnmount(() => {
        if (idleHandle) {
          cancelIdleCallback(idleHandle as unknown as number)
          idleHandle = null
        }
      })
      return () => isIdle.value ? h(componentLoader, attrs) : (instance.vnode.el && nuxt.isHydrating) ? createVNode(createStaticVNode(getFragmentHTML(instance.vnode.el ?? null, true)?.join('') || '', 1)) : null
    },
  })
}
