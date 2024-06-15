import { createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, ComponentInternalInstance, Ref } from 'vue'
// import ClientOnly from '#app/components/client-only'
import { getFragmentHTML } from '#app/components/utils'
import { useNuxtApp } from '#app/nuxt'
import { cancelIdleCallback, requestIdleCallback } from '#app/compat/idle-callback'
import { onNuxtReady } from '#app'
import { useIntersectionObserver } from '#app/utils'

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
          const observer = useIntersectionObserver(attrs.loader as Partial<IntersectionObserverInit> | undefined)
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

const eventsMapper = new WeakMap<ComponentInternalInstance, (() => void)[]>()
/* @__NO_SIDE_EFFECTS__ */
export const createLazyEventClientPage = (componentLoader: Component) => {
  return defineComponent({
    inheritAttrs: false,
    setup (_, { attrs }) {
      if (import.meta.server) {
        return () => h(componentLoader, attrs)
      }
      const nuxt = useNuxtApp()
      const instance = getCurrentInstance()!
      const isTriggered = ref(false)
      const events: string[] = attrs.loader as string[] ?? ['mouseover']

      const registeredEvents: (() => void)[] = []
      if (!eventsMapper.has(instance)) {
        onMounted(() => {
          events.forEach((event) => {
            const handler = () => {
              isTriggered.value = true
              registeredEvents.forEach(remove => remove())
              eventsMapper.delete(instance)
            }
            instance.vnode.el?.addEventListener(event, handler)
            registeredEvents.push(() => instance.vnode.el?.removeEventListener(event, handler))
          })
          eventsMapper.set(instance, registeredEvents)
        })
      }
      onBeforeUnmount(() => {
        registeredEvents?.forEach(remove => remove())
        eventsMapper.delete(instance)
      })
      return () => isTriggered.value ? h(componentLoader, attrs) : (instance.vnode.el && nuxt.isHydrating) ? createVNode(createStaticVNode(getFragmentHTML(instance.vnode.el ?? null, true)?.join('') || '', 1)) : null
    },
  })
}
