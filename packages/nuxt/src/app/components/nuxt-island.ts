import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'
import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { getFragmentHTML, getSlotProps } from './utils'
import { useNuxtApp } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'

const pKey = '_islandPromises'
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/
const UID_ATTR = /nuxt-ssr-component-uid(="([^"]*)")?/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g
const SLOT_FALLBACK_RE = /<div nuxt-slot-fallback-start="([^"]*)"[^>]*><\/div>(((?!<div nuxt-slot-fallback-end[^>]*>)[\s\S])*)<div nuxt-slot-fallback-end[^>]*><\/div>/g

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
  async setup (props, { slots }) {
    const nuxtApp = useNuxtApp()
    const hashId = computed(() => hash([props.name, props.props, props.context]))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    const ssrHTML = ref<string>(process.client ? getFragmentHTML(instance.vnode?.el ?? null).join('') ?? '<div></div>' : '<div></div>')
    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID())
    const availableSlots = computed(() => {
      return [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1])
    })

    const html = computed(() => {
      const currentSlots = Object.keys(slots)
      return ssrHTML.value.replace(SLOT_FALLBACK_RE, (full, slotName, content) => {
        // remove fallback to insert slots
        if (currentSlots.includes(slotName)) {
          return ''
        }
        return content
      })
    })
    function setUid () {
      uid.value = ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID() as string
    }
    const cHead = ref<Record<'link' | 'style', Array<Record<string, string>>>>({ link: [], style: [] })
    useHead(cHead)
    const slotProps = computed(() => {
      return getSlotProps(ssrHTML.value)
    })

    function _fetchComponent () {
      const url = `/__nuxt_island/${props.name}:${hashId.value}`
      if (process.server && process.env.prerender) {
        // Hint to Nitro to prerender the island component
        appendResponseHeader(event, 'x-nitro-prerender', url)
      }
      // TODO: Validate response
      return $fetch<NuxtIslandResponse>(url, {
        params: {
          ...props.context,
          props: props.props ? JSON.stringify(props.props) : undefined
        }
      })
    }
    const key = ref(0)
    async function fetchComponent () {
      nuxtApp[pKey] = nuxtApp[pKey] || {}
      if (!nuxtApp[pKey][uid.value]) {
        nuxtApp[pKey][uid.value] = _fetchComponent().finally(() => {
          delete nuxtApp[pKey]![uid.value]
        })
      }
      const res: NuxtIslandResponse = await nuxtApp[pKey][uid.value]
      cHead.value.link = res.head.link
      cHead.value.style = res.head.style
      ssrHTML.value = res.html.replace(UID_ATTR, () => {
        return `nuxt-ssr-component-uid="${randomUUID()}"`
      })
      key.value++
      if (process.client) {
        // must await next tick for Teleport to work correctly with static node re-rendering
        await nextTick()
      }
      setUid()
    }

    if (process.client) {
      watch(props, debounce(fetchComponent, 100))
    }

    if (process.server || !nuxtApp.isHydrating) {
      await fetchComponent()
    }

    return () => {
      const nodes = [createVNode(Fragment, {
        key: key.value
      }, [h(createStaticVNode(html.value, 1))])]
      if (uid.value && (mounted.value || nuxtApp.isHydrating || process.server)) {
        for (const slot in slots) {
          if (availableSlots.value.includes(slot)) {
            nodes.push(createVNode(Teleport, { to: process.client ? `[nuxt-ssr-component-uid='${uid.value}'] [nuxt-ssr-slot-name='${slot}']` : `uid=${uid.value};slot=${slot}` }, {
              default: () => (slotProps.value[slot] ?? [undefined]).map((data: any) => slots[slot]?.(data))
            }))
          }
        }
      }
      return nodes
    }
  }
})
