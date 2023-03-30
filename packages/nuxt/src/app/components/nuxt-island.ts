import type { VNode, RendererNode } from 'vue'
import { defineComponent, createStaticVNode, computed, ref, watch, getCurrentInstance, Teleport, onMounted, createVNode } from 'vue'
import { debounce } from 'perfect-debounce'
import { hash } from 'ohash'
import { appendHeader } from 'h3'
import { useHead } from '@unhead/vue'

// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandResponse } from '../../core/runtime/nitro/renderer'
import { useNuxtApp } from '#app/nuxt'
import { useRequestEvent } from '#app/composables/ssr'

const pKey = '_islandPromises'
const SSR_UID_RE = /v-ssr-component-uid="([^"]*)"/

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
    const html = ref<string>(process.client ? getFragmentHTML(instance.vnode?.el ?? null).join('') ?? '<div></div>' : '<div></div>')
    let uid = html.value.match(SSR_UID_RE)?.[1]
    function setUid () {
      uid = html.value.match(SSR_UID_RE)?.[1]
    }
    const cHead = ref<Record<'link' | 'style', Array<Record<string, string>>>>({ link: [], style: [] })
    useHead(cHead)

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

    async function fetchComponent () {
      nuxtApp[pKey] = nuxtApp[pKey] || {}
      if (!nuxtApp[pKey][hashId.value]) {
        nuxtApp[pKey][hashId.value] = _fetchComponent().finally(() => {
          delete nuxtApp[pKey]![hashId.value]
        })
      }
      const res: NuxtIslandResponse = await nuxtApp[pKey][hashId.value]
      cHead.value.link = res.head.link
      cHead.value.style = res.head.style
      html.value = res.html
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
      if (!mounted.value && process.client && !html.value) {
        html.value = getFragmentHTML(instance.vnode.el).join('')
        setUid()
        return [getStaticVNode(instance.vnode)]
      }
      const nodes = [createStaticVNode(html.value, 1)]
      if (uid) {
        for (const slot in slots) {
          nodes.push(createVNode(Teleport, { to: process.client ? `[v-ssr-component-uid='${uid}'] [v-ssr-slot-name='${slot}']` : `uid=${uid};slot=${slot}` }, [slots[slot]?.()]))
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
