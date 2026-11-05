import type { DefineSetupFnComponent, PropType, VNode } from 'vue'
import { createStaticVNode, defineComponent, getCurrentInstance, shallowRef, toRaw, useId } from 'vue'
import type { NuxtIslandResponse } from '../types'
import { useNuxtApp } from '../nuxt'
import { createError } from '../composables/error'
import { useIslandFetch } from './island-fetch'
import { getFragmentHTML, withIslandScopeId } from './utils'
import { domToVNode, htmlToVNode } from './islands-v2/dom-to-vnode'
import { isMarkerNonce } from './islands-v2/shared'

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

interface MarkerNonces {
  nonce: string
  nonces?: string[]
}

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
    const serverHTML = shallowRef<string | undefined>()
    const tree = shallowRef<VNode | undefined>()

    const { islandKey, fetchComponent, load } = useIslandFetch({
      props,
      uid: useId(),
      emit,
      toPayload: ({ html, ...data }) => {
        const revive: Partial<NuxtIslandResponse> = {}
        if (data.head) { revive.head = data.head }
        if (data.nonce) { revive.nonce = data.nonce }
        if (data.nonces) { revive.nonces = data.nonces }
        return { revive, data: import.meta.client ? { ...data, html } : data }
      },
      apply: (res) => {
        const markerNonces = readMarkerNonces(res)
        if (!markerNonces) {
          throw createError({ status: 500, statusText: `Island ${props.name} response has no valid marker nonce` })
        }
        const html = withIslandScopeId(res.html, props.scopeId, true)
        if (import.meta.server) {
          // Inside another island's render, the outer response carries these markers.
          const ssrContext = nuxtApp.ssrContext
          if (ssrContext?.islandNonce && ssrContext.islandNonce !== markerNonces.nonce) {
            const nested = ssrContext.islandNonces ??= new Set()
            for (const nonce of [markerNonces.nonce, ...markerNonces.nonces ?? []]) { nested.add(nonce) }
          }
          serverHTML.value = html
        } else {
          tree.value = htmlToVNode(html, { ...markerNonces, previous: tree.value })
        }
      },
    })

    expose({
      refresh: () => fetchComponent(true),
    })

    await load(() => {
      const entry = toRaw(nuxtApp.payload.data[islandKey.value])
      const markerNonces = readMarkerNonces(entry)
      if (!markerNonces) {
        throw createError({ status: 500, statusText: `Island ${props.name} has no valid marker nonce in the payload` })
      }
      const el = instance.vnode.el as Node
      entry.html = getFragmentHTML(el, false, { comments: true })!.join('')
      tree.value = domToVNode(el, markerNonces)
    })

    return () => {
      if (import.meta.server) {
        return serverHTML.value ? createStaticVNode(serverHTML.value, 1) : null
      }
      return tree.value ?? null
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits>

export default NuxtIsland

/**
 * Marker nonces of an island response or payload entry, or `undefined` when any is invalid.
 */
function readMarkerNonces (data: Partial<NuxtIslandResponse> | undefined): MarkerNonces | undefined {
  const nonce = data?.nonce
  const nonces = data?.nonces
  if (!isMarkerNonce(nonce)) { return }
  if (nonces === undefined) { return { nonce } }
  if (!Array.isArray(nonces) || !nonces.every(isMarkerNonce)) { return }
  return { nonce, nonces }
}
