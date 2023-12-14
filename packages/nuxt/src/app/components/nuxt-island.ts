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
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { getFragmentHTML, getSlotProps } from './utils'

// @ts-expect-error virtual file
import { remoteComponentIslands } from '#build/nuxt.config.mjs'

const pKey = '_islandPromises'
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/
const UID_ATTR = /nuxt-ssr-component-uid(="([^"]*)")?/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g
const SLOT_FALLBACK_RE = /<div nuxt-slot-fallback-start="([^"]*)"[^>]*><\/div>(((?!<div nuxt-slot-fallback-end[^>]*>)[\s\S])*)<div nuxt-slot-fallback-end[^>]*><\/div>/g

let id = 0
const getId = import.meta.client ? () => (id++).toString() : randomUUID

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
  async setup (props, { slots, expose }) {
    const error = ref<unknown>(null)
    const config = useRuntimeConfig()
    const nuxtApp = useNuxtApp()
    const filteredProps = computed(() => props.props ? Object.fromEntries(Object.entries(props.props).filter(([key]) => !key.startsWith('data-v-'))) : {})
    const hashId = computed(() => hash([props.name, filteredProps.value, props.context, props.source]))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()
    // TODO: remove use of `$fetch.raw` when nitro 503 issues on windows dev server are resolved
    const eventFetch = import.meta.server ? event.fetch : import.meta.dev ? $fetch.raw : globalThis.fetch
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    function setPayload (key: string, result: NuxtIslandResponse) {
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
          ...(import.meta.server && import.meta.prerender)
            ? {}
            : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } }
        },
        ...result
      }
    }

    const ssrHTML = ref<string>('')
    if (import.meta.client) {
      const renderedHTML = getFragmentHTML(instance.vnode?.el ?? null)?.join('') ?? ''
      if (renderedHTML && nuxtApp.isHydrating) {
        setPayload(`${props.name}_${hashId.value}`, {
          html: getFragmentHTML(instance.vnode?.el ?? null, true)?.join('') ?? '',
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
    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? getId())
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

      const url = remoteComponentIslands && props.source ? new URL(`/__nuxt_island/${key}.json`, props.source).href : `/__nuxt_island/${key}.json`

      if (import.meta.server && import.meta.prerender) {
        // Hint to Nitro to prerender the island component
        nuxtApp.runWithContext(() => prerenderRoutes(url))
      }
      // TODO: Validate response
      // $fetch handles the app.baseURL in dev
      const r = await eventFetch(withQuery(((import.meta.dev && import.meta.client) || props.source) ? url : joinURL(config.app.baseURL ?? '', url), {
        ...props.context,
        props: props.props ? JSON.stringify(props.props) : undefined
      }))
      const result = import.meta.server || !import.meta.dev ? await r.json() : (r as FetchResponse<NuxtIslandResponse>)._data
      // TODO: support passing on more headers
      if (import.meta.server && import.meta.prerender) {
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
        if (import.meta.client) {
          // must await next tick for Teleport to work correctly with static node re-rendering
          await nextTick()
        }
        setUid()
      } catch (e) {
        error.value = e
      }
    }

    expose({
      refresh: () => fetchComponent(true)
    })

    if (import.meta.hot) {
      import.meta.hot.on(`nuxt-server-component:${props.name}`, () => {
        fetchComponent(true)
      })
    }

    if (import.meta.client) {
      watch(props, debounce(() => fetchComponent(), 100))
    }

    if (import.meta.client && !nuxtApp.isHydrating && props.lazy) {
      fetchComponent()
    } else if (import.meta.server || !nuxtApp.isHydrating || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    }

    return () => {
      if ((!html.value || error.value) && slots.fallback) {
        return [slots.fallback({ error: error.value })]
      }
      const nodes = [createVNode(Fragment, {
        key: key.value
      }, [h(createStaticVNode(html.value || '<div></div>', 1))])]
      if (uid.value && (mounted.value || nuxtApp.isHydrating || import.meta.server)) {
        for (const slot in slots) {
          if (availableSlots.value.includes(slot)) {
            nodes.push(createVNode(Teleport, { to: import.meta.client ? `[nuxt-ssr-component-uid='${uid.value}'] [nuxt-ssr-slot-name='${slot}']` : `uid=${uid.value};slot=${slot}` }, {
              default: () => (slotProps.value[slot] ?? [undefined]).map((data: any) => slots[slot]?.(data))
            }))
          }
        }
      }
      return nodes
    }
  }
})
