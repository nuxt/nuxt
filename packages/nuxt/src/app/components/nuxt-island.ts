import { defineComponent, createStaticVNode, computed, ref, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import type { MetaObject } from '@nuxt/schema'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useHead, useNuxtApp } from '#app'

const pKey = '_islandPromises'

export default defineComponent({
  name: 'NuxtIsland',
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
    const hashId = computed(() => hash([props.name, props.props, props.context]))
    const html = ref<string>('')
    const cHead = ref<MetaObject>({ link: [], style: [] })
    useHead(cHead)

    function _fetchComponent () {
      // TODO: Validate response
      return $fetch<NuxtIslandResponse>(`/__nuxt_island/${props.name}:${hashId.value}`, {
        params: {
          ...props.context,
          props: props.props ? JSON.stringify(props.props) : undefined
        }
      })
    }

    async function fetchComponent () {
      nuxtApp[pKey] = nuxtApp[pKey] || {}
      if (!nuxtApp[pKey][hashId.value]) {
        nuxtApp[pKey][hashId.value] = _fetchComponent().finally(() => {
          delete nuxtApp[pKey][hashId.value]
        })
      }
      const res: NuxtIslandResponse = await nuxtApp[pKey][hashId.value]
      cHead.value.link = res.head.link
      cHead.value.style = res.head.style
      html.value = res.html
    }

    if (process.server || !nuxtApp.isHydrating) {
      await fetchComponent()
    }

    if (process.client) {
      watch(props, debounce(fetchComponent, 100))
    }

    return () => createStaticVNode(html.value, 1)
  }
})
