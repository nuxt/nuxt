import type { Component } from 'vue'
import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, toRaw, watch, withMemo } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'
import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL, withQuery } from 'ufo'
import type { FetchResponse } from 'ofetch'
import { join } from 'pathe'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { getFragmentHTML } from './utils'

// @ts-expect-error virtual file
import { remoteComponentIslands, selectiveClient } from '#build/nuxt.config.mjs'

const pKey = '_islandPromises'
const SSR_UID_RE = /data-island-uid="([^"]*)"/
const DATA_ISLAND_UID_RE = /data-island-uid(="")?(?!="[^"])/g
const SLOTNAME_RE = /data-island-slot="([^"]*)"/g
const SLOT_FALLBACK_RE = / data-island-slot="([^"]*)"[^>]*>/g

let id = 1
const getId = import.meta.client ? () => (id++).toString() : randomUUID

const components = import.meta.client ? new Map<string, Component>() : undefined

async function loadComponents (source = '/', paths: NuxtIslandResponse['components']) {
  const promises = []

  for (const component in paths) {
    if (!(components!.has(component))) {
      promises.push((async () => {
        const chunkSource = join(source, paths[component].chunk)
        const c = await import(/* @vite-ignore */ chunkSource).then(m => m.default || m)
        components!.set(component, c)
      })())
    }
  }
  await Promise.all(promises)
}

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
    },
    dangerouslyLoadClientComponents: {
      type: Boolean,
      default: false
    }
  },
  async setup (props, { slots, expose }) {
    let canTeleport = import.meta.server
    const teleportKey = ref(0)
    const key = ref(0)
    const canLoadClientComponent = computed(() => selectiveClient && (props.dangerouslyLoadClientComponents || !props.source))
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
    onMounted(() => { mounted.value = true; teleportKey.value++ })

    function setPayload (key: string, result: NuxtIslandResponse) {
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
          ...(import.meta.server && import.meta.prerender)
            ? {}
            : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } },
          result: {
            props: result.props,
            slots: result.slots,
            components: result.components
          }
        },
        ...result
      }
    }

    const payloadSlots: NonNullable<NuxtIslandResponse['slots']> = {}
    const payloadComponents: NonNullable<NuxtIslandResponse['components']> = {}

    if (nuxtApp.isHydrating) {
      Object.assign(payloadSlots, toRaw(nuxtApp.payload.data[`${props.name}_${hashId.value}`])?.slots ?? {})
      Object.assign(payloadComponents, toRaw(nuxtApp.payload.data[`${props.name}_${hashId.value}`])?.components ?? {})
    }

    const ssrHTML = ref<string>('')

    if (import.meta.client && nuxtApp.isHydrating) {
      ssrHTML.value = getFragmentHTML(instance.vnode?.el ?? null, true)?.join('') || ''
    }

    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? getId())
    const availableSlots = computed(() => [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1]))
    const html = computed(() => {
      const currentSlots = Object.keys(slots)
      let html = ssrHTML.value

      if (import.meta.client && !canLoadClientComponent.value) {
        for (const [key, value] of Object.entries(payloadComponents || {})) {
          html = html.replace(new RegExp(` data-island-uid="${uid.value}" data-island-component="${key}"[^>]*>`), (full) => {
            return full + value.html
          })
        }
      }

      return html.replaceAll(SLOT_FALLBACK_RE, (full, slotName) => {
        if (!currentSlots.includes(slotName)) {
          return full + payloadSlots[slotName]?.fallback ?? ''
        }
        return full
      })
    })

    const cHead = ref<Record<'link' | 'style', Array<Record<string, string>>>>({ link: [], style: [] })
    useHead(cHead)

    async function _fetchComponent (force = false) {
      const key = `${props.name}_${hashId.value}`

      if (nuxtApp.payload.data[key]?.html && !force) { return nuxtApp.payload.data[key] }

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
        ssrHTML.value = res.html.replaceAll(DATA_ISLAND_UID_RE, `data-island-uid="${uid.value}"`)
        key.value++
        error.value = null
        Object.assign(payloadSlots, res.slots || {})
        Object.assign(payloadComponents, res.components || {})

        if (selectiveClient && import.meta.client) {
          if (canLoadClientComponent.value && res.components) {
            await loadComponents(props.source, res.components)
          }
        }

        if (import.meta.client) {
          // must await next tick for Teleport to work correctly with static node re-rendering
          nextTick(() => {
            canTeleport = true
            teleportKey.value++
          })
        }
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
      watch(props, debounce(() => fetchComponent(), 100), { deep: true })
    }

    if (import.meta.client && !nuxtApp.isHydrating && props.lazy) {
      fetchComponent()
    } else if (import.meta.server || !nuxtApp.isHydrating || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    } else if (selectiveClient && canLoadClientComponent.value) {
      await loadComponents(props.source, payloadComponents)
    }

    return (_ctx: any, _cache: any) => {
      if (!html.value || error.value) {
        return [slots.fallback?.({ error: error.value }) ?? createVNode('div')]
      }
      return [
        withMemo([key.value], () => {
          return createVNode(Fragment, { key: key.value }, [h(createStaticVNode(html.value || '<div></div>', 1))])
        }, _cache, 0),

        // should away be triggered ONE tick after re-rendering the static node
        withMemo([teleportKey.value], () => {
          const teleports = []
          // this is used to force trigger Teleport when vue makes the diff between old and new node
          const isKeyOdd = teleportKey.value === 0 || !!(teleportKey.value && !(teleportKey.value % 2))

          if (uid.value && html.value && (import.meta.server || props.lazy ? canTeleport : mounted.value || nuxtApp.isHydrating)) {
            for (const slot in slots) {
              if (availableSlots.value.includes(slot)) {
                teleports.push(createVNode(Teleport,
                  // use different selectors for even and odd teleportKey to force trigger the teleport
                  { to: import.meta.client ? `${isKeyOdd ? 'div' : ''}[data-island-uid="${uid.value}"][data-island-slot="${slot}"]` : `uid=${uid.value};slot=${slot}` },
                  { default: () => (payloadSlots[slot].props?.length ? payloadSlots[slot].props : [{}]).map((data: any) => slots[slot]?.(data)) })
                )
              }
            }
            if (import.meta.server) {
              for (const [id, info] of Object.entries(payloadComponents ?? {})) {
                const { html } = info
                teleports.push(createVNode(Teleport, { to: `uid=${uid.value};client=${id}` }, {
                  default: () => [createStaticVNode(html, 1)]
                }))
              }
            }
            if (selectiveClient && import.meta.client && canLoadClientComponent.value) {
              for (const [id, info] of Object.entries(payloadComponents ?? {})) {
                const { props } = info
                const component = components!.get(id)!
                // use different selectors for even and odd teleportKey to force trigger the teleport
                const vnode = createVNode(Teleport, { to: `${isKeyOdd ? 'div' : ''}[data-island-uid='${uid.value}'][data-island-component="${id}"]` }, {
                  default: () => {
                    return [h(component, props)]
                  }
                })
                teleports.push(vnode)
              }
            }
          }

          return h(Fragment, teleports)
        }, _cache, 1)
      ]
    }
  }
})
