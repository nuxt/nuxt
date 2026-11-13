import type { DefineSetupFnComponent, PropType, SlotsType, VNode } from 'vue'
import { defineComponent, getCurrentInstance, shallowRef, toRaw, useId, watch } from 'vue'
import type { NuxtAppLiterals, NuxtIslandResponse } from '../types'
import { type NuxtApp, useNuxtApp } from '../nuxt'
import { createError, isNuxtError } from '../composables/error'
import { useIslandFetch } from './island-fetch'
import { withIslandScopeId } from './utils'
import { type RemoteIsland, domToVNode, htmlToVNode, outerHTMLOf } from './islands-v2/dom-to-vnode'
import { type MarkerSet, createMarkerSet, readChunkPaths, readMarkerNonces, rebindMarkerNonces, rebindMarkers } from './islands-v2/shared'
import { renderIslandSlots } from './islands-v2/render-slots'

import { remoteComponentIslands } from '#build/nuxt.config.mjs'

interface NuxtIslandProps {
  name: NuxtAppLiterals['islandName']
  lazy?: boolean
  props?: Record<string, any>
  context?: Record<string, any>
  scopeId?: string | undefined | null
  source?: string
  dangerouslyLoadClientComponents?: boolean
}

type NuxtIslandEmits = {
  error: (error: unknown) => void
}

type NuxtIslandSlots = SlotsType<{
  fallback?: (props: { error: unknown }) => VNode[]
  [name: string]: ((props: any) => VNode[]) | undefined
}>

const ERROR_PAYLOAD_PREFIX = 'nuxt-island-error:'
/**
 * Fresh marker nonce of each response nonce, per server render and island key: keying by the island
 * keeps a response that claims another island's public nonce from getting that island's fresh one.
 */
const REBOUND_NONCES = new WeakMap<NuxtApp, Map<string, Map<string, string>>>()

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
  async setup (props, { expose, emit, slots }) {
    const nuxtApp = useNuxtApp()
    const instance = getCurrentInstance()!
    const serverIsland = shallowRef<{ html: string, markers: MarkerSet } | undefined>()
    const tree = shallowRef<VNode | undefined>()
    const id = useId()
    const errorKey = `${ERROR_PAYLOAD_PREFIX}${id}`

    const { error, islandKey, fetchComponent, load } = useIslandFetch({
      props,
      uid: id,
      emit,
      toPayload: ({ html, chunks, ...rest }) => {
        // Only a remote island loading its client components reads the chunk paths.
        const data: Partial<NuxtIslandResponse> = chunks && remoteOf(props, { chunks })?.chunks ? { ...rest, chunks } : rest
        const markerNonces = import.meta.server ? readMarkerNonces(data, false) : undefined
        // The page hydrates with the nonces `apply` rebinds the markers to.
        if (markerNonces) { Object.assign(data, rebindMarkerNonces(markerNonces, reboundNoncesOf(nuxtApp, islandKey.value))) }
        const revive: Partial<NuxtIslandResponse> = {}
        if (data.head) { revive.head = data.head }
        if (data.nonce) { revive.nonce = data.nonce }
        if (data.nonces) { revive.nonces = data.nonces }
        if (data.chunks) { revive.chunks = data.chunks }
        return { revive, data: import.meta.client ? { ...data, html } : data }
      },
      apply: (res) => {
        if (typeof res.html !== 'string') {
          throw createError({ status: 500, statusText: `Island ${props.name} response has no HTML` })
        }
        const remote = remoteOf(props, res)
        const markerNonces = readMarkerNonces(res, !!remote)
        if (!markerNonces) {
          throw createError({ status: 500, statusText: `Island ${props.name} response has no valid marker nonce` })
        }
        const html = withIslandScopeId(res.html, props.scopeId)
        if (import.meta.server) {
          // Slots render into the HTML, so its markers move to nonces this render made (see `rebindMarkerNonces`).
          const bound = rebindMarkers(html, markerNonces, reboundNoncesOf(nuxtApp, islandKey.value))
          // Inside another island's render, the outer response carries these markers; a remote island's stay plain.
          const islands = nuxtApp.ssrContext?.islands
          if (islands && !remote && islands.markers.nonce !== markerNonces.nonce) {
            for (const nonce of [bound.nonce, ...bound.nonces ?? []]) { islands.nested.add(nonce) }
            Object.assign(islands.chunks, res.chunks)
          }
          serverIsland.value = { html: bound.html, markers: createMarkerSet(bound.nonce) }
        } else {
          tree.value = htmlToVNode(html, { ...markerNonces, previous: tree.value, slots, remote })
        }
      },
    })

    if (import.meta.client) {
      watch(error, (value) => { if (value) { tree.value = undefined } })
    }

    expose({
      refresh: () => fetchComponent(true),
    })

    await load(() => {
      const serverError = toRaw(nuxtApp.payload.data[errorKey])
      if (serverError) {
        error.value = serverError
        return
      }
      const entry = toRaw(nuxtApp.payload.data[islandKey.value])
      const remote = remoteOf(props, entry)
      const markerNonces = readMarkerNonces(entry, !!remote)
      if (!markerNonces) {
        throw createError({ status: 500, statusText: `Island ${props.name} has no valid marker nonce in the payload` })
      }
      const el = instance.vnode.el as Node
      entry.html = outerHTMLOf(el, markerNonces.nonce)
      tree.value = domToVNode(el, { ...markerNonces, slots, remote })
    })

    if (import.meta.server && error.value) {
      error.value = isNuxtError(error.value) ? error.value : createError({ status: 500 })
      nuxtApp.payload.data[errorKey] = error.value
    }

    return () => {
      const island = serverIsland.value
      if (import.meta.server && island?.html && !error.value) {
        return renderIslandSlots(island.html, island.markers, slots)
      }
      if (import.meta.client && tree.value && !error.value) {
        return tree.value
      }
      return slots.fallback?.({ error: error.value }) ?? null
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits, NuxtIslandSlots>

export default NuxtIsland

function reboundNoncesOf (nuxtApp: NuxtApp, islandKey: string): Map<string, string> {
  let islands = REBOUND_NONCES.get(nuxtApp)
  if (!islands) { REBOUND_NONCES.set(nuxtApp, islands = new Map()) }
  let rebound = islands.get(islandKey)
  if (!rebound) { islands.set(islandKey, rebound = new Map()) }
  return rebound
}

/**
 * Remote rules for an island fetched from `source`, with the chunks it may load when opted in.
 */
function remoteOf (props: Pick<NuxtIslandProps, 'source' | 'dangerouslyLoadClientComponents'>, data: Partial<NuxtIslandResponse> | undefined): RemoteIsland | undefined {
  if (!remoteComponentIslands || !props.source) { return }
  return {
    source: props.source,
    chunks: props.dangerouslyLoadClientComponents ? readChunkPaths(data?.chunks) : undefined,
  }
}
