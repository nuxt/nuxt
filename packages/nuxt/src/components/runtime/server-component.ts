import { defineComponent, getCurrentInstance, h, ref } from 'vue'
import type { DefineSetupFnComponent } from 'vue'
import NuxtIsland from '#app/components/nuxt-island'
import { useRoute } from '#app/composables/router'
import { isPrerendered } from '#app/composables/payload'
import { createError, showError } from '#app/composables/error'
import { useNuxtApp } from '#app/nuxt'

interface ServerComponentProps {
  lazy?: boolean
}

type ServerComponentEmits = {
  error: (error: unknown) => void
}

type ServerComponentType = DefineSetupFnComponent<ServerComponentProps, ServerComponentEmits>
type IslandPageType = DefineSetupFnComponent<ServerComponentProps>

/* @__NO_SIDE_EFFECTS__ */
export const createServerComponent = (name: string): ServerComponentType => {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    emits: ['error'],
    setup (props, { attrs, slots, expose, emit }) {
      const vm = getCurrentInstance()
      const islandRef = ref<{ refresh: () => Promise<void> } | null>(null)

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
  }) as unknown as ServerComponentType
}

/* @__NO_SIDE_EFFECTS__ */
export const createIslandPage = (name: string, islandKey?: string): IslandPageType => {
  const component = defineComponent({
    name,
    inheritAttrs: false,
    props: { lazy: Boolean },
    async setup (props, { slots, expose }) {
      const islandRef = ref<{ refresh: () => Promise<void> } | null>(null)

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
            onError: (e: unknown) => {
              if (e instanceof Error && e.cause && e.cause instanceof Response) {
                throw createError({
                  status: e.cause.status,
                  statusText: e.cause.statusText,
                })
              }
              nuxtApp.runWithContext(() => showError(e as Error))
            },
          }, slots),
        ])
      }
    },
  })

  // we use this to validate that a server page is rendering the correct url
  if (import.meta.server && islandKey) {
    (component as any).__nuxt_island = islandKey
  }
  return component as unknown as IslandPageType
}
