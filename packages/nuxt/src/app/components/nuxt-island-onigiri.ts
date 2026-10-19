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
  /** Nonce the markers inside `html` are bound to. */
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
    // Island HTML from Vue's SSR render with the nonce its markers are bound to; the server inlines it as static content.
    const marked = shallowRef<MarkedHTML | undefined>()
    // Shallow: the tree is swapped whole, walking a deeply reactive one would cost more than rendering it.
    const tree = shallowRef<VNode | undefined>()
    const uid = ref<string>(useId() || getId())

    const { islandKey, fetchComponent, guard, load } = useIslandFetch({
      props,
      uid,
      emit,
      // The DOM already carries the HTML; the client only needs the nonce to read its markers.
      toPayload: ({ html: _html, ...data }) => {
        const revive: Partial<NuxtIslandResponse> = {}
        if (data.head) { revive.head = data.head }
        if (data.nonce) { revive.nonce = data.nonce }
        return { revive, data }
      },
      apply: (res) => {
        const nonce = res.nonce
        if (!isMarkerNonce(nonce)) {
          throw createError({ status: 500, statusText: `Island ${props.name} response has no valid marker nonce` })
        }
        let html = res.html
        const outerNonce = import.meta.server ? (nuxtApp.ssrContext as { onigiriNonce?: string } | undefined)?.onigiriNonce : undefined
        if (outerNonce && outerNonce !== nonce) {
          // Nested in another island's render: the client reads this HTML with the outer island's nonce.
          html = html.replace(new RegExp(`<!--(/?o:[ct]):${nonce}`, 'g'), `<!--$1:${outerNonce}`)
        }
        marked.value = { html, nonce }
        if (import.meta.client) {
          // Unchanged static runs keep their VNode, so the patch only touches what the server changed.
          tree.value = htmlToVNode(res.html, { nonce, previous: tree.value })
        }
      },
    })

    expose({
      refresh: () => fetchComponent(true),
    })

    await load(() => guard(() => {
      // Without a valid nonce no marker can be trusted, and the legacy prefixes must never be honoured here.
      const nonce = toRaw(nuxtApp.payload.data[islandKey.value])?.nonce
      if (!isMarkerNonce(nonce)) {
        throw createError({ status: 500, statusText: `Island ${props.name} has no valid marker nonce in the payload` })
      }
      tree.value = domToVNode(instance.vnode.el as Node, { nonce })
    }))

    // No custom `importFn`: marker chunk references are source paths (and bare package
    // specifiers), which the generated `vue-onigiri/manifest` module resolves in both
    // environments via its globs and `extraEntries`.
    return () => {
      if (import.meta.server) {
        // Vue's SSR renderer pushes static content raw; the node count only matters on the client.
        return marked.value ? createStaticVNode(marked.value.html, 1) : null
      }
      return tree.value ?? null
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits, NuxtIslandSlots>

export default NuxtIsland
