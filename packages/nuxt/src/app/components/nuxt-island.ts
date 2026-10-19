import type { Component, DefineSetupFnComponent, PropType, RendererNode, SlotsType, VNode } from 'vue'
import { Fragment, Teleport, computed, createStaticVNode, createVNode, defineComponent, getCurrentInstance, h, nextTick, onMounted, ref, shallowRef, toRaw, withMemo } from 'vue'
import { randomUUID } from 'uncrypto'
import { joinURL } from 'ufo'

import type { NuxtAppLiterals, NuxtIslandResponse } from '../types'
import { useNuxtApp } from '../nuxt'
import { getFragmentHTML, isEndFragment, isStartFragment } from './utils'
import { useIslandFetch } from './island-fetch'
import { renderDiagnostics } from '../diagnostics/render'

import { appBaseURL, selectiveClient } from '#build/nuxt.config.mjs'

const SSR_UID_RE = /data-island-uid="([^"]*)"/
const DATA_ISLAND_UID_RE = /(?<=<[^<>"]*(?:"[^"]*"[^<>"]*)*\s)data-island-uid(="")?(?=[\s/>])/g
const SLOTNAME_RE = /data-island-slot="([^"]*)"/g
const SLOT_FALLBACK_RE = / data-island-slot="([^"]*)"[^>]*>/g
const ISLAND_SCOPE_ID_RE = /^<[^> ]*/
const VUE_SCOPE_ID_RE = /^data-v-[\w-]+$/

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
  async setup (props, { slots, expose, emit }) {
    let canTeleport = import.meta.server
    const teleportKey = shallowRef(0)
    const key = shallowRef(0)
    const canLoadClientComponent = computed(() => selectiveClient && (props.dangerouslyLoadClientComponents || !props.source))
    const nuxtApp = useNuxtApp()
    const instance = getCurrentInstance()!
    const uid = ref<string>('')
    const payloads: Partial<Pick<NuxtIslandResponse, 'slots' | 'components'>> = {}
    const ssrHTML = ref<string>('')

    const { error, islandKey, fetchComponent, load } = useIslandFetch({
      props,
      uid,
      emit,
      toPayload: (result) => {
        const revive: Partial<NuxtIslandResponse> = {}
        if (result.props) { revive.props = result.props }
        if (result.slots) { revive.slots = result.slots }
        if (result.components) { revive.components = result.components }
        if (result.head) { revive.head = result.head }
        return { revive, data: result }
      },
      apply: async (res) => {
        ssrHTML.value = res.html.replaceAll(DATA_ISLAND_UID_RE, `data-island-uid="${uid.value}"`)
        key.value++
        payloads.slots = res.slots || {}
        payloads.components = res.components || {}

        if (import.meta.server && res.components && Object.keys(res.components).length) {
          const parentIslandContext = nuxtApp.ssrContext?.islandContext

          // parent response needs to keep the nested islands UID
          if (parentIslandContext) {
            for (const [id, { html: _, ...component }] of Object.entries(res.components)) {
              parentIslandContext.components[id] = { ...component, uid: uid.value }
            }
          }
        }

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
      },
    })

    const mounted = shallowRef(false)
    onMounted(() => { mounted.value = true; teleportKey.value++ })

    if (instance.vnode.el) {
      const slots = toRaw(nuxtApp.payload.data[islandKey.value])?.slots
      if (slots) { payloads.slots = slots }
      if (selectiveClient) {
        const components = toRaw(nuxtApp.payload.data[islandKey.value])?.components
        if (components) { payloads.components = components }
      }
    }

    if (import.meta.client && instance.vnode?.el) {
      if (import.meta.dev) {
        let currentEl = instance.vnode.el
        let startEl: RendererNode | null = null
        let isFirstElement = true

        while (currentEl) {
          if (isEndFragment(currentEl)) {
            if (startEl !== currentEl.previousSibling) {
              renderDiagnostics.NUXT_E4005({ name: props.name })
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
      const key = islandKey.value
      nuxtApp.payload.data[key] ||= {}
      // clear all data-island-uid to avoid conflicts when saving into payloads
      nuxtApp.payload.data[key].html = ssrHTML.value.replaceAll(new RegExp(`data-island-uid="${ssrHTML.value.match(SSR_UID_RE)?.[1] || ''}"`, 'g'), `data-island-uid=""`)
    }

    uid.value = ssrHTML.value.match(SSR_UID_RE)?.[1] || getId()

    const currentSlots = new Set(Object.keys(slots))
    const availableSlots = computed(() => new Set([...ssrHTML.value.matchAll(SLOTNAME_RE)].map(m => m[1])))
    const html = computed(() => {
      let html = ssrHTML.value

      if (props.scopeId) {
        if (VUE_SCOPE_ID_RE.test(props.scopeId)) {
          html = html.replace(ISLAND_SCOPE_ID_RE, full => full + ' ' + props.scopeId)
        } else if (import.meta.dev) {
          renderDiagnostics.NUXT_E4019({ scopeId: props.scopeId })
        }
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

    expose({
      refresh: () => fetchComponent(true),
    })

    await load(() => {
      if (selectiveClient && canLoadClientComponent.value) {
        return loadComponents(props.source, payloads.components)
      }
    })

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
                const slotPayload = payloads.slots?.[slot]
                const scopeId = slotPayload?.scopeId
                // the scope id can come from a remote island, so it has to be validated
                const slotScopeId = scopeId && VUE_SCOPE_ID_RE.test(scopeId) ? `${scopeId}-s` : undefined
                teleports.push(createVNode(Teleport,
                  // use different selectors for even and odd teleportKey to force trigger the teleport
                  { to: import.meta.client ? `${isKeyOdd ? 'div' : ''}[data-island-uid="${uid.value}"][data-island-slot="${slot}"]` : `uid=${uid.value};slot=${slot}` },
                  { default: () => (slotPayload?.props?.length ? slotPayload.props : [{}]).map((data) => {
                    const content = slots[slot]?.(data)
                    if (!slotScopeId) {
                      return content
                    }
                    // Vue only reads `slotScopeIds` off a fragment, and normally adds it in
                    // `renderSlot`, which runs inside the scoped component rather than here.
                    const fragment: VNode & { slotScopeIds?: string[] } = createVNode(Fragment, null, content)
                    fragment.slotScopeIds = [slotScopeId]
                    return fragment
                  }) },
                ))
              }
            }
            if (selectiveClient) {
              if (import.meta.server) {
                if (payloads.components) {
                  for (const [id, info] of Object.entries(payloads.components)) {
                    const { html, slots, uid: targetUID = uid.value } = info
                    let replaced = html.replaceAll(DATA_ISLAND_UID_RE, `data-island-uid="${uid.value}"`)
                    for (const slot in slots) {
                      replaced = replaced.replaceAll(`data-island-slot="${slot}">`, full => full + slots[slot])
                    }
                    teleports.push(createVNode(Teleport, { to: `uid=${targetUID};client=${id}` }, {
                      default: () => [createStaticVNode(replaced, 1)],
                    }))
                  }
                }
              } else if (canLoadClientComponent.value && payloads.components) {
                for (const [id, info] of Object.entries(payloads.components)) {
                  const { props, slots, uid: targetUID = uid.value } = info
                  const component = components!.get(id)!
                  // use different selectors for even and odd teleportKey to force trigger the teleport
                  const vnode = createVNode(Teleport, { to: `${isKeyOdd ? 'div' : ''}[data-island-uid='${targetUID}'][data-island-component="${id}"]` }, {
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
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits, NuxtIslandSlots>

export default NuxtIsland
