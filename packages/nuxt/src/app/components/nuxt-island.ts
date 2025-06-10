import type { Component, PropType, RendererNode, VNode } from 'vue'
import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch, withMemo } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendResponseHeader } from 'h3'
import type { ActiveHeadEntry, SerializableHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL, withQuery } from 'ufo'
import type { FetchResponse } from 'ofetch'

import type { NuxtIslandResponse } from '../types'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { injectHead } from '../composables/head'
import { getFragmentHTML, isEndFragment, isStartFragment } from './utils'

// @ts-expect-error virtual file
import { appBaseURL, remoteComponentIslands, selectiveClient } from '#build/nuxt.config.mjs'

const pKey = '_islandPromises'
const SSR_UID_RE = /data-island-uid="([^"]*)"/
const DATA_ISLAND_UID_RE = /data-island-uid(="")?(?!="[^"])/g
const SLOTNAME_RE = /data-island-slot="([^"]*)"/g
const SLOT_FALLBACK_RE = / data-island-slot="([^"]*)"[^>]*>/g
const ISLAND_SCOPE_ID_RE = /^<[^> ]*/

let id = 1
const getId = import.meta.client ? () => (id++).toString() : randomUUID

const components = import.meta.client ? new Map<string, Component>() : undefined

async function loadComponents (source = appBaseURL, paths: NuxtIslandResponse['components']) {
  if (!paths) { return }

  const promises: Array<Promise<void>> = []

  for (const [component, item] of Object.entries(paths)) {
    if (!(components!.has(component))) {
      promises.push((async () => {
        const chunkSource = joinURL(source, item.chunk)
        const c = await import(/* @vite-ignore */ chunkSource).then(m => m.default || m)
        components!.set(component, c)
      })())
    }
  }

  await Promise.all(promises)
}

export default defineComponent({
  name: 'NuxtIsland',
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      required: true,
    },
    lazy: Boolean,
    props: {
      type: Object,
      default: () => undefined,
    },
    context: {
      type: Object,
      default: () => ({}),
    },
    scopeId: {
      type: String as PropType<string | undefined | null>,
      default: () => undefined,
    },
    source: {
      type: String,
      default: () => undefined,
    },
    dangerouslyLoadClientComponents: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['error'],
  async setup (props, { slots, expose, emit }) {
    let canTeleport = import.meta.server
    const teleportKey = shallowRef(0)
    const key = shallowRef(0)
    const canLoadClientComponent = computed(() => selectiveClient && (props.dangerouslyLoadClientComponents || !props.source))
    const error = ref<unknown>(null)
    const config = useRuntimeConfig()
    const nuxtApp = useNuxtApp()
    const filteredProps = computed(() => props.props ? Object.fromEntries(Object.entries(props.props).filter(([key]) => !key.startsWith('data-v-'))) : {})
    const hashId = computed(() => hash([props.name, filteredProps.value, props.context, props.source]).replace(/[-_]/g, ''))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()

    let activeHead: ActiveHeadEntry<SerializableHead>

    // TODO: remove use of `$fetch.raw` when nitro 503 issues on windows dev server are resolved
    const eventFetch = import.meta.server ? event!.fetch : import.meta.dev ? $fetch.raw : globalThis.fetch
    const mounted = shallowRef(false)
    onMounted(() => { mounted.value = true; teleportKey.value++ })
    onBeforeUnmount(() => { if (activeHead) { activeHead.dispose() } })
    function setPayload (key: string, result: NuxtIslandResponse) {
      const toRevive: Partial<NuxtIslandResponse> = {}
      if (result.props) { toRevive.props = result.props }
      if (result.slots) { toRevive.slots = result.slots }
      if (result.components) { toRevive.components = result.components }
      if (result.head) { toRevive.head = result.head }
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
          ...(import.meta.server && import.meta.prerender)
            ? {}
            : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } },
          result: toRevive,
        },
        ...result,
      }
    }

    const payloads: Partial<Pick<NuxtIslandResponse, 'slots' | 'components'>> = {}

    if (instance.vnode.el) {
      const slots = toRaw(nuxtApp.payload.data[`${props.name}_${hashId.value}`])?.slots
      if (slots) { payloads.slots = slots }
      if (selectiveClient) {
        const components = toRaw(nuxtApp.payload.data[`${props.name}_${hashId.value}`])?.components
        if (components) { payloads.components = components }
      }
    }

    const ssrHTML = ref<string>('')

    if (import.meta.client && instance.vnode?.el) {
      if (import.meta.dev) {
        let currentEl = instance.vnode.el
        let startEl: RendererNode | null = null
        let isFirstElement = true

        while (currentEl) {
          if (isEndFragment(currentEl)) {
            if (startEl !== currentEl.previousSibling) {
              console.warn(`[\`Server components(and islands)\`] "${props.name}" must have a single root element. (HTML comments are considered elements as well.)`)
            }
            break
          } else if (!isStartFragment(currentEl) && isFirstElement) {
            // find first non-comment node
            isFirstElement = false
            if (currentEl.nodeType === 1) {
              startEl = currentEl
            }
          }
          currentEl = currentEl.nextSibling
        }
      }
      ssrHTML.value = getFragmentHTML(instance.vnode.el, true)?.join('') || ''
      const key = `${props.name}_${hashId.value}`
      nuxtApp.payload.data[key] ||= {}
      // clear all data-island-uid to avoid conflicts when saving into payloads
      nuxtApp.payload.data[key].html = ssrHTML.value.replaceAll(new RegExp(`data-island-uid="${ssrHTML.value.match(SSR_UID_RE)?.[1] || ''}"`, 'g'), `data-island-uid=""`)
    }

    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] || getId())

    const currentSlots = new Set(Object.keys(slots))
    const availableSlots = computed(() => new Set([...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1])))
    const html = computed(() => {
      let html = ssrHTML.value

      if (props.scopeId) {
        html = html.replace(ISLAND_SCOPE_ID_RE, full => full + ' ' + props.scopeId)
      }

      if (import.meta.client && !canLoadClientComponent.value) {
        for (const [key, value] of Object.entries(payloads.components || {})) {
          html = html.replace(new RegExp(` data-island-uid="${uid.value}" data-island-component="${key}"[^>]*>`), (full) => {
            return full + value.html
          })
        }
      }

      if (payloads.slots) {
        return html.replaceAll(SLOT_FALLBACK_RE, (full, slotName) => {
          if (!currentSlots.has(slotName)) {
            return full + (payloads.slots?.[slotName]?.fallback || '')
          }
          return full
        })
      }
      return html
    })

    const head = injectHead()

    async function _fetchComponent (force = false) {
      const key = `${props.name}_${hashId.value}`

      if (!force && nuxtApp.payload.data[key]?.html) { return nuxtApp.payload.data[key] }

      const url = remoteComponentIslands && props.source ? new URL(`/__nuxt_island/${key}.json`, props.source).href : `/__nuxt_island/${key}.json`

      if (import.meta.server && import.meta.prerender) {
        // Hint to Nitro to prerender the island component
        nuxtApp.runWithContext(() => prerenderRoutes(url))
      }
      // TODO: Validate response
      // $fetch handles the app.baseURL in dev
      const r = await eventFetch(withQuery(((import.meta.dev && import.meta.client) || props.source) ? url : joinURL(config.app.baseURL ?? '', url), {
        ...props.context,
        props: props.props ? JSON.stringify(props.props) : undefined,
      }))
      try {
        const result = import.meta.server || !import.meta.dev ? await r.json() : (r as FetchResponse<NuxtIslandResponse>)._data
        // TODO: support passing on more headers
        if (import.meta.server && import.meta.prerender) {
          const hints = r.headers.get('x-nitro-prerender')
          if (hints) {
            appendResponseHeader(event!, 'x-nitro-prerender', hints)
          }
        }
        setPayload(key, result)
        return result
      } catch (e: any) {
        if (r.status !== 200) {
          throw new Error(e.toString(), { cause: r })
        }
        throw e
      }
    }

    async function fetchComponent (force = false) {
      nuxtApp[pKey] ||= {}
      nuxtApp[pKey][uid.value] ||= _fetchComponent(force).finally(() => {
        delete nuxtApp[pKey]![uid.value]
      })
      try {
        const res: NuxtIslandResponse = await nuxtApp[pKey][uid.value]

        ssrHTML.value = res.html.replaceAll(DATA_ISLAND_UID_RE, `data-island-uid="${uid.value}"`)
        key.value++
        error.value = null
        payloads.slots = res.slots || {}
        payloads.components = res.components || {}

        if (selectiveClient && import.meta.client) {
          if (canLoadClientComponent.value && res.components) {
            await loadComponents(props.source, res.components)
          }
        }

        if (res?.head) {
          if (activeHead) {
            activeHead.patch(res.head)
          } else {
            activeHead = head.push(res.head)
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
        emit('error', e)
      }
    }

    expose({
      refresh: () => fetchComponent(true),
    })

    if (import.meta.hot) {
      import.meta.hot.on(`nuxt-server-component:${props.name}`, () => {
        fetchComponent(true)
      })
    }

    if (import.meta.client) {
      watch(props, debounce(() => fetchComponent(), 100), { deep: true })
    }

    if (import.meta.client && !instance.vnode.el && props.lazy) {
      fetchComponent()
    } else if (import.meta.server || !instance.vnode.el || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    } else if (selectiveClient && canLoadClientComponent.value) {
      await loadComponents(props.source, payloads.components)
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
          const teleports: Array<VNode> = []
          // this is used to force trigger Teleport when vue makes the diff between old and new node
          const isKeyOdd = teleportKey.value === 0 || !!(teleportKey.value && !(teleportKey.value % 2))

          if (uid.value && html.value && (import.meta.server || props.lazy ? canTeleport : (mounted.value || instance.vnode?.el))) {
            for (const slot in slots) {
              if (availableSlots.value.has(slot)) {
                teleports.push(createVNode(Teleport,
                  // use different selectors for even and odd teleportKey to force trigger the teleport
                  { to: import.meta.client ? `${isKeyOdd ? 'div' : ''}[data-island-uid="${uid.value}"][data-island-slot="${slot}"]` : `uid=${uid.value};slot=${slot}` },
                  { default: () => (payloads.slots?.[slot]?.props?.length ? payloads.slots[slot].props : [{}]).map((data: any) => slots[slot]?.(data)) }),
                )
              }
            }
            if (selectiveClient) {
              if (import.meta.server) {
                if (payloads.components) {
                  for (const [id, info] of Object.entries(payloads.components)) {
                    const { html, slots } = info
                    let replaced = html.replaceAll('data-island-uid', `data-island-uid="${uid.value}"`)
                    for (const slot in slots) {
                      replaced = replaced.replaceAll(`data-island-slot="${slot}">`, full => full + slots[slot])
                    }
                    teleports.push(createVNode(Teleport, { to: `uid=${uid.value};client=${id}` }, {
                      default: () => [createStaticVNode(replaced, 1)],
                    }))
                  }
                }
              } else if (canLoadClientComponent.value && payloads.components) {
                for (const [id, info] of Object.entries(payloads.components)) {
                  const { props, slots } = info
                  const component = components!.get(id)!
                  // use different selectors for even and odd teleportKey to force trigger the teleport
                  const vnode = createVNode(Teleport, { to: `${isKeyOdd ? 'div' : ''}[data-island-uid='${uid.value}'][data-island-component="${id}"]` }, {
                    default: () => {
                      return [h(component, props, Object.fromEntries(Object.entries(slots || {}).map(([k, v]) => ([k, () => createStaticVNode(`<div style="display: contents" data-island-uid data-island-slot="${k}">${v}</div>`, 1),
                      ]))))]
                    },
                  })
                  teleports.push(vnode)
                }
              }
            }
          }

          return h(Fragment, teleports)
        }, _cache, 1),
      ]
    }
  },
})
