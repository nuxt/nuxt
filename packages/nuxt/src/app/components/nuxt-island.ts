import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'
import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL, withQuery } from 'ufo'
import type { FetchResponse } from 'ofetch'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { getFragmentHTML, getSlotProps } from './utils'
import { useNuxtApp, useRuntimeConfig } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'

const pKey = '_islandPromises'
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/
const UID_ATTR = /nuxt-ssr-component-uid(="([^"]*)")?/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g
const SLOT_FALLBACK_RE = /<div nuxt-slot-fallback-start="([^"]*)"[^>]*><\/div>(((?!<div nuxt-slot-fallback-end[^>]*>)[\s\S])*)<div nuxt-slot-fallback-end[^>]*><\/div>/g

let id = 0
const getId = process.client ? () => (id++).toString() : randomUUID

export default defineComponent({
  name: 'NuxtIsland',
  props: {
    name: {
      type: String,
      required: true
    },
    lazy: Boolean,
    props: {
      type: Object,
      default: () => undefined
    },
    context: {
      type: Object,
      default: () => ({})
    },
    source: {
      type: String,
      default: () => undefined
    }
  },
  async setup (props, { slots }) {
    const error = ref<unknown>(null)
    const config = useRuntimeConfig()
    const nuxtApp = useNuxtApp()
    const hashId = computed(() => hash([props.name, props.props, props.context, props.source]))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()
    // TODO: remove use of `$fetch.raw` when nitro 503 issues on windows dev server are resolved
    const eventFetch = process.server ? event.fetch : process.dev ? $fetch.raw : globalThis.fetch
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    function setPayload (key: string, result: NuxtIslandResponse) {
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
          ...(process.server && process.env.prerender)
            ? {}
            : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } }
        },
        ...result
      }
    }

    const ssrHTML = ref<string>('')
    if (process.client) {
      const renderedHTML = getFragmentHTML(instance.vnode?.el ?? null).join('')
      if (renderedHTML && nuxtApp.isHydrating) {
        setPayload(`${props.name}_${hashId.value}`, {
          html: getFragmentHTML(instance.vnode?.el ?? null, true).join(''),
          state: {},
          head: {
            link: [],
            style: []
          }
        })
      }
      ssrHTML.value = renderedHTML
    }
    const slotProps = computed(() => getSlotProps(ssrHTML.value))
    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID())
    const availableSlots = computed(() => [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1]))

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
      uid.value = ssrHTML.value.match(SSR_UID_RE)?.[1] ?? getId() as string
    }
    const cHead = ref<Record<'link' | 'style', Array<Record<string, string>>>>({ link: [], style: [] })
    useHead(cHead)

    async function _fetchComponent (force = false) {
      const key = `${props.name}_${hashId.value}`
      if (nuxtApp.payload.data[key] && !force) { return nuxtApp.payload.data[key] }

      const url = props.source ? new URL(`/__nuxt_island/${key}`, props.source).href : `/__nuxt_island/${key}`

      if (process.server && process.env.prerender) {
        // Hint to Nitro to prerender the island component
        appendResponseHeader(event, 'x-nitro-prerender', url)
      }
      // TODO: Validate response
      // $fetch handles the app.baseURL in dev
      const r = await eventFetch(withQuery(process.dev && process.client ? url : joinURL(config.app.baseURL ?? '', url), {
        ...props.context,
        props: props.props ? JSON.stringify(props.props) : undefined
      }))
      const result = process.server || !process.dev ? await r.json() : (r as FetchResponse<NuxtIslandResponse>)._data
      // TODO: support passing on more headers
      if (process.server && process.env.prerender) {
        const hints = r.headers.get('x-nitro-prerender')
        if (hints) {
          appendResponseHeader(event, 'x-nitro-prerender', hints)
        }
      }
      setPayload(key, result)
      return result
    }
    const key = ref(0)
    async function fetchComponent (force = false) {
      nuxtApp[pKey] = nuxtApp[pKey] || {}
      if (!nuxtApp[pKey][uid.value]) {
        nuxtApp[pKey][uid.value] = _fetchComponent(force).finally(() => {
          delete nuxtApp[pKey]![uid.value]
        })
      }
      try {
        const res: NuxtIslandResponse = await nuxtApp[pKey][uid.value]
        cHead.value.link = res.head.link
        cHead.value.style = res.head.style
        ssrHTML.value = res.html.replace(UID_ATTR, () => {
          return `nuxt-ssr-component-uid="${getId()}"`
        })
        key.value++
        error.value = null
        if (process.client) {
          // must await next tick for Teleport to work correctly with static node re-rendering
          await nextTick()
        }
        setUid()
      } catch (e) {
        error.value = e
      }
    }

    if (import.meta.hot) {
      import.meta.hot.on(`nuxt-server-component:${props.name}`, () => {
        fetchComponent(true)
      })
    }

    if (process.client) {
      watch(props, debounce(() => fetchComponent(), 100))
    }

    if (process.client && !nuxtApp.isHydrating && props.lazy) {
      fetchComponent()
    } else if (process.server || !nuxtApp.isHydrating) {
      await fetchComponent()
    }

    return () => {
      if ((!html.value || error.value) && slots.fallback) {
        return [slots.fallback({ error: error.value })]
      }
      const nodes = [createVNode(Fragment, {
        key: key.value
      }, [h(createStaticVNode(html.value || '<div></div>', 1))])]
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
