import type { Component } from 'vue'
import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, toRaw, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { useHead } from '@unhead/vue'
import { joinURL, withQuery } from 'ufo'
import type { FetchResponse } from 'ofetch'
import { join } from 'pathe'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { SLOTNAME_RE, SSR_UID_RE, UID_ATTR, getFragmentHTML, getSlotProps, nuxtIslandProps, pKey } from './utils'

// @ts-expect-error virtual file
import { remoteComponentIslands, selectiveClient } from '#build/nuxt.config.mjs'

const SLOT_FALLBACK_RE = /<div nuxt-slot-fallback-start="([^"]*)"[^>]*><\/div>(((?!<div nuxt-slot-fallback-end[^>]*>)[\s\S])*)<div nuxt-slot-fallback-end[^>]*><\/div>/g

let id = 0
const getId = () => (id++).toString()

const components = new Map<string, Component>()

async function loadComponents (source = '/', paths: Record<string, string>) {
  const promises = []

  for (const component in paths) {
    if (!(components!.has(component))) {
      promises.push((async () => {
        const chunkSource = join(source, paths[component])
        const c = await import(/* @vite-ignore */ chunkSource).then(m => m.default || m)
        components!.set(component, c)
      })())
    }
  }
  await Promise.all(promises)
}

function emptyPayload () {
  return {
    chunks: {},
    props: {},
    teleports: {}
  }
}

export default defineComponent({
  name: 'NuxtIsland',
  props: {
    ...nuxtIslandProps
  },
  async setup (props, { slots, expose }) {
    // used to force re-render the static content
    const key = ref(0)
    const canLoadClientComponent = computed(() => selectiveClient && (props.dangerouslyLoadClientComponents || !props.source))
    const error = ref<unknown>(null)
    const config = useRuntimeConfig()
    const nuxtApp = useNuxtApp()
    const filteredProps = computed(() => props.props ? Object.fromEntries(Object.entries(props.props).filter(([key]) => !key.startsWith('data-v-'))) : {})
    const hashId = computed(() => hash([props.name, filteredProps.value, props.context, props.source]))
    const instance = getCurrentInstance()!

    // TODO: remove use of `$fetch.raw` when nitro 503 issues on windows dev server are resolved
    const eventFetch = import.meta.dev ? $fetch.raw : globalThis.fetch
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    function setPayload (key: string, result: NuxtIslandResponse) {
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
            params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } ,
          result: {
            chunks: result.chunks,
            props: result.props,
            teleports: result.teleports
          }
        },
        ...result
      }
    }
    // needs to be non-reactive because we don't want to trigger re-renders
    // at hydration, we only retrieve props/chunks/teleports from payload. See the reviver at nuxt\src\app\plugins\revive-payload.client.ts
    // If not hydrating, fetchComponent() will set it
    const rawPayload = nuxtApp.isHydrating ? toRaw(nuxtApp.payload.data)?.[`${props.name}_${hashId.value}`] ?? emptyPayload() : emptyPayload()

    const ssrHTML = ref<string>(getFragmentHTML(instance.vnode?.el ?? null, true)?.join('') || '')

    const slotProps = computed(() => getSlotProps(ssrHTML.value))
    // during hydration we directly retrieve the uid from the payload
    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? getId())
    const availableSlots = computed(() => [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1]))

    const html = computed(() => {
      const currentSlots = Object.keys(slots)
      let html = ssrHTML.value

      if (!canLoadClientComponent.value) {
        for (const [key, value] of Object.entries(rawPayload.teleports || {})) {
          html = html.replace(new RegExp(`<div [^>]*nuxt-ssr-client="${key}"[^>]*>`), (full) => {
            return full + value
          })
        }
      }

      return html.replace(SLOT_FALLBACK_RE, (full, slotName, content) => {
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

      if (nuxtApp.payload.data[key]?.html && !force) { return nuxtApp.payload.data[key] }

      const url = remoteComponentIslands && props.source ? new URL(`/__nuxt_island/${key}.json`, props.source).href : `/__nuxt_island/${key}.json`

      // TODO: Validate response
      // $fetch handles the app.baseURL in dev
      const r = await eventFetch(withQuery((import.meta.dev || props.source) ? url : joinURL(config.app.baseURL ?? '', url), {
        ...props.context,
        props: props.props ? JSON.stringify(props.props) : undefined
      }))
      const result = import.meta.dev ? (r as FetchResponse<NuxtIslandResponse>)._data : await r.json()

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
        ssrHTML.value = res.html.replace(UID_ATTR, () => {
          return `nuxt-ssr-component-uid="${getId()}"`
        })
        // force re-render the static content
        key.value++
        error.value = null

        if (selectiveClient) {
          if (canLoadClientComponent.value && res.chunks) {
            await loadComponents(props.source, res.chunks)
          }
          rawPayload.props = res.props
        }
        rawPayload.teleports = res.teleports
        rawPayload.chunks = res.chunks

        // must await next tick for Teleport to work correctly so vue can teleport the content to the new static node
        // teleport update is based on uid
        await nextTick()
       
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

    watch(props, debounce(() => fetchComponent(), 100))
 
    if (!nuxtApp.isHydrating && props.lazy) {
      fetchComponent()
    } else if (!nuxtApp.isHydrating || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    } else if (selectiveClient && canLoadClientComponent.value && rawPayload.chunks) {
      await loadComponents(props.source, rawPayload.chunks)
    }

    return () => {
      if (!html.value || error.value) {
        return [slots.fallback?.({ error: error.value }) ?? createVNode('div')]
      }
      const nodes = [createVNode(Fragment, {
        // static nodes in build need to be keyed to force it to re-render
        key: key.value
      }, [h(createStaticVNode(html.value || '<div></div>', 1))])]

      if (uid.value && (mounted.value || nuxtApp.isHydrating) && html.value) {
        // render slots
        for (const slot in slots) {
          if (availableSlots.value.includes(slot)) {
            nodes.push(createVNode(Teleport, { to:  `[nuxt-ssr-component-uid='${uid.value}'] [nuxt-ssr-slot-name='${slot}']` }, {
              default: () => (slotProps.value[slot] ?? [undefined]).map((data: any) => slots[slot]?.(data))
            }))
          }
        }

        // render components
        if (selectiveClient && canLoadClientComponent.value) {
          for (const [id, props] of Object.entries(rawPayload.props ?? {})) {
            const component = components!.get(id.split('-')[0])!
            const vnode = createVNode(Teleport, { to: `[nuxt-ssr-component-uid='${uid.value}'] [nuxt-ssr-client="${id}"]` }, {
              default: () => {
                return [h(component, props)]
              }
            })
            nodes.push(vnode)
          }
        }
      }
      return nodes
    }
  }
})
