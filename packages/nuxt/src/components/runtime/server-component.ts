import { Fragment, computed, createStaticVNode, createVNode, defineComponent, h, ref, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendHeader } from 'h3'

import { useHead } from '@unhead/vue'
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'
import { useAsyncData } from '#app/composables/asyncData'

const pKey = '_islandPromises'

export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup (_props, { attrs }) {
      return () => h(NuxtServerComponent, {
        name,
        props: attrs
      })
    }
  })
}

const NuxtServerComponent = defineComponent({
  name: 'NuxtServerComponent',
  props: {
    name: {
      type: String,
      required: true
    },
    props: {
      type: Object,
      default: () => undefined
    },
    context: {
      type: Object,
      default: () => ({})
    }
  },
  async setup (props) {
    const nuxtApp = useNuxtApp()
    const key = ref(0)
    const hashId = computed(() => hash([props.name, props.props, props.context]))

    const event = useRequestEvent()

    function _fetchComponent () {
      const url = `/__nuxt_island/${props.name}:${hashId.value}`
      if (process.server && process.env.prerender) {
        // Hint to Nitro to prerender the island component
        appendHeader(event, 'x-nitro-prerender', url)
      }
      // TODO: Validate response
      return $fetch<NuxtIslandResponse>(url, {
        params: {
          ...props.context,
          props: props.props ? JSON.stringify(props.props) : undefined
        }
      })
    }

    const res = useAsyncData(
      `${props.name}:${hashId.value}`,
      async () => {
        nuxtApp[pKey] = nuxtApp[pKey] || {}
        if (!nuxtApp[pKey][hashId.value]) {
          nuxtApp[pKey][hashId.value] = _fetchComponent().finally(() => {
            delete nuxtApp[pKey]![hashId.value]
          })
        }
        const res: NuxtIslandResponse = await nuxtApp[pKey][hashId.value]
        return {
          html: res.html,
          head: {
            link: res.head.link,
            style: res.head.style
          }
        }
      }, {
        immediate: process.server || !nuxtApp.isHydrating,
        default: () => ({
          html: '',
          head: {
            link: [], style: []
          }
        })
      }
    )

    useHead(() => res.data.value!.head)

    if (process.client) {
      watch(props, debounce(async () => {
        await res.execute()
        key.value++
      }, 100))
    }

    await res

    return () => createVNode(Fragment, { key: key.value }, [createStaticVNode(res.data.value!.html, 1)])
  }
})
