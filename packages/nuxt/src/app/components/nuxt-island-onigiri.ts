import type { DefineSetupFnComponent, PropType, SlotsType, VNode } from 'vue'
import { computed, defineComponent, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, useId, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import type { ActiveHeadEntry, SerializableHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL } from 'ufo'
import { renderOnigiri } from 'vue-onigiri/runtime/deserialize'
import type { NuxtIslandResponse } from '../types'
import { useNuxtApp } from '../nuxt'
import { createError } from '../composables/error'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { injectHead } from '../composables/head'
import { getIslandHash, serializeIslandProps } from '../island-hash'

import { remoteComponentIslands } from '#build/nuxt.config.mjs'
import { $fetch } from '#build/fetch'

const pKey = '_islandPromises'


let id = 1
const getId = import.meta.client ? () => (id++).toString() : randomUUID

interface NuxtIslandProps {
  name: string
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
  async setup (props, { expose, emit }) {
    const teleportKey = ref(0)
    const error = ref<unknown>(null)
    const nuxtApp = useNuxtApp()
    const serializedProps = computed(() => serializeIslandProps(props.props))
    const hashId = computed(() => getIslandHash({ name: props.name, props: serializedProps.value, context: props.context, source: props.source }))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()
    const ast = ref(nuxtApp.payload.data[`${props.name}_${hashId.value}`]?.ast)
    let activeHead: ActiveHeadEntry<SerializableHead>

    const mounted = shallowRef(false)
    onMounted(() => { mounted.value = true; teleportKey.value++ })
    onBeforeUnmount(() => { if (activeHead) { activeHead.dispose() } })
    function setPayload (key: string, result: NuxtIslandResponse) {
      const toRevive: Partial<NuxtIslandResponse> = {}
      if (result.head) { toRevive.head = result.head }
      if (result.ast) { toRevive.ast = result.ast }
      nuxtApp.payload.data[key] = {
        __nuxt_island: {
          key,
          ...(import.meta.server && import.meta.prerender)
            ? {}
            : { params: { ...props.context, props: props.props ? serializedProps.value : undefined } },
          result: toRevive,
        },
        ...result,
      }
    }

    const uid = ref<string>(useId() || getId())
    const head = injectHead()

    async function _fetchComponent (force = false) {
      const key = `${props.name}_${hashId.value}`

      if (!force && nuxtApp.payload.data[key]?.ast) { return nuxtApp.payload.data[key] }

      const url = remoteComponentIslands && props.source ? joinURL(props.source, `/__nuxt_island/${key}.json`) : `/__nuxt_island/${key}.json`
      if (import.meta.server && import.meta.prerender) {
        // Hint to Nitro to prerender the island component
        nuxtApp.runWithContext(() => prerenderRoutes(url))
      }
      // TODO: Validate response
      // $fetch handles `app.baseURL` for relative URLs
      const r = await $fetch.raw<NuxtIslandResponse>(url, {
        // custom island sources should not be resolved against `app.baseURL` (#23093)
        ...(props.source ? { baseURL: '' } : {}),
        query: {
          ...props.context,
          props: props.props ? serializedProps.value : undefined,
        },
        responseType: 'json',
        ignoreResponseError: true,
      })
      if (!r.ok) {
        throw createError({ status: r.status, statusText: r.statusText })
      }
      try {
        const result = r._data!
        // TODO: support passing on more headers
        if (import.meta.server && import.meta.prerender) {
          const hints = r.headers.get('x-nitro-prerender')
          if (hints) {
            event!.res.headers.append('x-nitro-prerender', hints)
          }
        }
        setPayload(key, result)
        return result
      } catch (e: any) {
        if (r.status !== 200) {
          throw new Error(e.toString(), { cause: e })
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

        if (res.ast) {
          ast.value = res.ast
        }
        error.value = null

        if (res?.head) {
          if (activeHead) {
            activeHead.patch(res.head)
          } else {
            activeHead = head.push(res.head)
          }
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

    // Restore head entries from SSR payload during hydration
    if (import.meta.client && instance.vnode.el) {
      const headData = toRaw(nuxtApp.payload.data[`${props.name}_${hashId.value}`])?.head
      if (headData) {
        activeHead = head.push(headData)
      }
    }

    if (import.meta.client && !instance.vnode.el && props.lazy) {
      fetchComponent()
    } else if (import.meta.server || !instance.vnode.el || !nuxtApp.payload.serverRendered) {
      await fetchComponent()
    }

    // No custom `importFn`: AST chunk references are source paths (and bare package
    // specifiers), which the `virtual:onigiri/manifest` module resolves in both
    // environments via its globs and `extraEntries`.
    return () => renderOnigiri(ast.value)
  },
}) as unknown as DefineSetupFnComponent<NuxtIslandProps, NuxtIslandEmits, NuxtIslandSlots>

export default NuxtIsland
