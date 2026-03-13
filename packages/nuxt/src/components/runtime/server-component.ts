import { defineComponent, getCurrentInstance, h, ref } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'
import { useRoute } from '#app/composables/router'
import { isPrerendered } from '#app/composables/payload'
import { createError, showError } from '#app/composables/error'
import { useNuxtApp } from '#app/nuxt'

/* @__NO_SIDE_EFFECTS__ */
export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    emits: ['error'],
    setup (props, { attrs, slots, expose, emit }) {
      const vm = getCurrentInstance()
      const islandRef = ref<null | typeof NuxtIsland>(null)

      expose({
        refresh: () => islandRef.value?.refresh(),
      })

      return () => {
        return h(NuxtIsland, {
          name,
          lazy: props.lazy,
          props: attrs,
          scopeId: vm?.vnode.scopeId,
          ref: islandRef,
          onError: (err) => {
            emit('error', err)
          },
        }, slots)
      }
    },
  })
}

/* @__NO_SIDE_EFFECTS__ */
export const createIslandPage = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    async setup (props, { slots, expose }) {
      const islandRef = ref<null | typeof NuxtIsland>(null)

      expose({
        refresh: () => islandRef.value?.refresh(),
      })
      const nuxtApp = useNuxtApp()
      const route = useRoute()
      const path = import.meta.client && await isPrerendered(route.path) ? route.path : route.fullPath.replace(/#.*$/, '')
      return () => {
        return h('div', [
          h(NuxtIsland, {
            name: `page_${name}`,
            lazy: props.lazy,
            ref: islandRef,
            context: { url: path },
            onError: (e) => {
              if (e.cause && e.cause instanceof Response) {
                throw createError({
                  status: e.cause.status,
                  statusText: e.cause.statusText,
                })
              }
              nuxtApp.runWithContext(() => showError(e))
            },
          }, slots),
        ])
      }
    },
  })
}
