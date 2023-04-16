import destr from 'destr'
import type { RendererNode, VNode } from 'vue'
import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, watch } from 'vue'

import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendHeader } from 'h3'
import { useHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { decodeHtmlEntities } from './utils'
import { useNuxtApp } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'

const pKey = '_islandPromises'
const SSR_UID_RE = /nuxt-ssr-component-uid="([^"]*)"/
const SLOTNAME_RE = /nuxt-ssr-slot-name="([^"]*)"/g
const SLOT_FALLBACK_RE = /<!-- slot-fallback-start:(\S*) -->((?!<!-- slot-fallback-end -->)[\\s\\S])*<!-- slot-fallback-end -->/g

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
    const key = ref(0)
    onMounted(() => { mounted.value = true })
    const ssrHTML = ref<string>(process.client ? getFragmentHTML(instance.vnode?.el ?? null).join('') ?? '<div></div>' : '<div></div>')
    const uid = ref<string>(ssrHTML.value.match(SSR_UID_RE)?.[1] ?? randomUUID())
    const availableSlots = computed(() => {
      return [...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1])
    })

    const html = computed(() => {
      const currentSlots = Object.keys(slots)
      const cleanedHtml = ssrHTML.value.replaceAll(SLOT_FALLBACK_RE, (full, slotName) => {
        if (currentSlots.includes(slotName)) {
          return ''
        }
        return full
      })
      return cleanedHtml
    })
    function setUid () {
      uid.value = ssrHTML.value.match(SSR_UID_RE)?.[1] as string
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
        appendHeader(event, 'x-nitro-prerender', url)
      }
      // TODO: Validate response
      return $fetch<NuxtIslandResponse>(url, {
        params: {
          ...props.context,
          props: props.props ? JSON.stringify(props.props) : undefined,
          slotsName: JSON.stringify(Object.keys(slots))
        }
      })
    }

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
      ssrHTML.value = res.html
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
      // bypass hydration
      if (!mounted.value && process.client && !ssrHTML.value) {
        ssrHTML.value = getFragmentHTML(instance.vnode.el).join('')
        setUid()
        return [getStaticVNode(instance.vnode)]
      }
      const nodes = [createVNode(Fragment, {
        key: key.value
      }, [h(createStaticVNode(html.value, 1))])]
      if (uid.value) {
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

// TODO refactor with https://github.com/nuxt/nuxt/pull/19231
function getStaticVNode (vnode: VNode) {
  const fragment = getFragmentHTML(vnode.el)

  if (fragment.length === 0) {
    return null
  }
  return createStaticVNode(fragment.join(''), fragment.length)
}

function getFragmentHTML (element: RendererNode | null) {
  if (element) {
    if (element.nodeName === '#comment' && element.nodeValue === '[') {
      return getFragmentChildren(element)
    }
    return [element.outerHTML]
  }
  return []
}

function getFragmentChildren (element: RendererNode | null, blocks: string[] = []) {
  if (element && element.nodeName) {
    if (isEndFragment(element)) {
      return blocks
    } else if (!isStartFragment(element)) {
      blocks.push(element.outerHTML)
    }

    getFragmentChildren(element.nextSibling, blocks)
  }
  return blocks
}

function isStartFragment (element: RendererNode) {
  return element.nodeName === '#comment' && element.nodeValue === '['
}

function isEndFragment (element: RendererNode) {
  return element.nodeName === '#comment' && element.nodeValue === ']'
}
const SLOT_PROPS_RE = /<div[^>]*nuxt-ssr-slot-name="([^"]*)" nuxt-ssr-slot-data="([^"]*)"[^/|>]*>/g
function getSlotProps (html: string) {
  const slotsDivs = html.matchAll(SLOT_PROPS_RE)
  const data:Record<string, any> = {}
  for (const slot of slotsDivs) {
    const [_, slotName, json] = slot
    const slotData = destr(decodeHtmlEntities(json))
    data[slotName] = slotData
  }
  return data
}
