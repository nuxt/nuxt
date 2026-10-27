import type { DefineSetupFnComponent, PropType, SlotsType, VNode } from 'vue'
import { createStaticVNode, defineComponent, getCurrentInstance, ref, shallowRef, toRaw, useId } from 'vue'
import { randomUUID } from 'uncrypto'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- rebuilds the island tree from its marked HTML
import { domToVNode, htmlToVNode, isMarkerNonce } from 'vue-onigiri'
import type { NuxtIslandResponse } from '../types'
import { useNuxtApp } from '../nuxt'
import { createError } from '../composables/error'
import { useIslandFetch } from './island-fetch'

interface NuxtIslandProps {
  name: string
  lazy?: boolean
  props?: Record<string, any>
  context?: Record<string, any>
  scopeId?: string | undefined | null
}

type NuxtIslandEmits = {
  error: (error: unknown) => void
}

type NuxtIslandSlots = SlotsType<{
  fallback?: (props: { error: unknown }) => VNode[]
  [name: string]: ((props: any) => VNode[]) | undefined
}>

interface MarkedHTML {
  html: string
  nonce: string
}

let id = 1
const getId = import.meta.client ? () => (id++).toString() : randomUUID

const NuxtIsland = defineComponent({
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
  },
  emits: ['error'],
  async setup (props, { expose, emit }) {
    const nuxtApp = useNuxtApp()
    const instance = getCurrentInstance()!
    const marked = shallowRef<MarkedHTML | undefined>()
    const tree = shallowRef<VNode | undefined>()
    const uid = ref<string>(useId() || getId())

    const { islandKey, fetchComponent, guard, load } = useIslandFetch({
      props,
      uid,
      emit,
      toPayload: ({ html, ...data }) => {
        const revive: Partial<NuxtIslandResponse> = {}
        if (data.head) { revive.head = data.head }
        if (data.nonce) { revive.nonce = data.nonce }
        return { revive, data: import.meta.client ? { ...data, html } : data }
      },
      apply: (res) => {
        const nonce = res.nonce
        if (!isMarkerNonce(nonce)) {
          throw createError({ status: 500, statusText: `Island ${props.name} response has no valid marker nonce` })
        }
        let html = res.html
        const outerNonce = import.meta.server ? (nuxtApp.ssrContext as { onigiriNonce?: string } | undefined)?.onigiriNonce : undefined
        if (outerNonce && outerNonce !== nonce) {
          html = html.replace(new RegExp(`<!--(/?o:[ct]):${nonce}`, 'g'), `<!--$1:${outerNonce}`)
        }
        marked.value = { html, nonce }
        if (import.meta.client) {
          tree.value = htmlToVNode(res.html, { nonce, previous: tree.value })
        }
      },
    })

    expose({
      refresh: () => fetchComponent(true),
    })

    await load(() => guard(() => {
      const entry = toRaw(nuxtApp.payload.data[islandKey.value])
      const nonce = entry?.nonce
      if (!isMarkerNonce(nonce)) {
        throw createError({ status: 500, statusText: `Island ${props.name} has no valid marker nonce in the payload` })
      }
      const el = instance.vnode.el as Node
      entry.html = readIslandHTML(el)
      tree.value = domToVNode(el, { nonce })
    }))

    return () => {
      if (import.meta.server) {
        return marked.value ? createStaticVNode(marked.value.html, 1) : null
      }
      return tree.value ?? null
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits, NuxtIslandSlots>

export default NuxtIsland

function readIslandHTML (start: Node): string {
  if (!isFragmentComment(start, '[')) {
    return nodeHTML(start)
  }
  let html = ''
  let depth = 0
  for (let node: Node | null = start; node; node = node.nextSibling) {
    html += nodeHTML(node)
    if (isFragmentComment(node, '[')) {
      depth++
    } else if (isFragmentComment(node, ']') && --depth === 0) {
      break
    }
  }
  return html
}

function isFragmentComment (node: Node, data: '[' | ']'): boolean {
  return node.nodeType === Node.COMMENT_NODE && (node as Comment).data === data
}

const TEXT_ESCAPE_RE = /[&<>]/g
const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

function nodeHTML (node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).outerHTML
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `<!--${(node as Comment).data}-->`
  }
  return (node.textContent ?? '').replace(TEXT_ESCAPE_RE, char => TEXT_ESCAPES[char]!)
}
