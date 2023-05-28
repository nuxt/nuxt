import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'

import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'
import { useAsyncData } from '#app/composables/asyncData'
import { getFragmentHTML, getSlotProps } from '#app/components/utils'

const pKey = '_islandPromises'
const UID_ATTR = /nuxt-ssr-component-uid(="([^"]*)")?/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g
const SLOT_FALLBACK_RE = /<div nuxt-slot-fallback-start="([^"]*)"[^>]*><\/div>(((?!<div nuxt-slot-fallback-end[^>]*>)[\s\S])*)<div nuxt-slot-fallback-end[^>]*><\/div>/g
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/

let id = 0
const getId = process.client ? () => (id++).toString() : randomUUID

export const createServerComponent = (name: string) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup (_props, { attrs, slots }) {
      return () => h(NuxtServerComponent, {
        name,
        props: attrs
      }, slots)
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
  async setup (props, { slots }) {
    const instance = getCurrentInstance()!
    const uid = ref(getFragmentHTML(instance.vnode?.el)[0]?.match(SSR_UID_RE)?.[1] ?? getId())

    const nuxtApp = useNuxtApp()
    const mounted = ref(false)
    const key = ref(0)
    onMounted(() => { mounted.value = true })
    const hashId = computed(() => hash([props.name, props.props, props.context]))

    const event = useRequestEvent()

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
        if (process.client) {
          // must await next tick for Teleport to work correctly with static node re-rendering
          await nextTick()
        }
        setUid()
      }, 100))
    }

    const slotProps = computed(() => {
      return getSlotProps(res.data.value!.html)
    })
    const availableSlots = computed(() => {
      return [...res.data.value!.html.matchAll(SLOTNAME_RE)].map(m => m[1])
    })

    const html = computed(() => {
      const currentSlots = Object.keys(slots)
      return res.data.value!.html
        .replace(UID_ATTR, () => `nuxt-ssr-component-uid="${getId()}"`)
        .replace(SLOT_FALLBACK_RE, (full, slotName, content) => {
        // remove fallback to insert slots
          if (currentSlots.includes(slotName)) {
            return ''
          }
          return content
        })
    })
    function setUid () {
      uid.value = html.value.match(SSR_UID_RE)?.[1] ?? getId() as string
    }

    await res

    if (process.server || !nuxtApp.isHydrating) {
      setUid()
    }

    return () => {
      const nodes = [createVNode(Fragment, {
        key: key.value
      }, [createStaticVNode(html.value, 1)])]
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
