import type { PropType } from 'vue'
import { computed, defineComponent, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { debounce } from 'perfect-debounce'
import type { ActiveHeadEntry, SerializableHead } from '@unhead/vue'
import { randomUUID } from 'uncrypto'
import { joinURL, withQuery } from 'ufo'
import type { FetchResponse } from 'ofetch'
import { renderOnigiri } from 'vue-onigiri/runtime/deserialize'
import type { ImportFn } from 'vue-onigiri/runtime/utils'
// @ts-expect-error virtual file
import { importFn as defaultOnigiriImportFn } from 'virtual:onigiri/manifest'
import type { NuxtIslandResponse } from '../types'
import { useNuxtApp, useRuntimeConfig } from '../nuxt'
import { createError } from '../composables/error'
import { prerenderRoutes, useRequestEvent } from '../composables/ssr'
import { injectHead } from '../composables/head'
import { computeIslandHash, filterIslandProps } from '../island-hash'

// @ts-expect-error virtual file
import { remoteComponentIslands } from '#build/nuxt.config.mjs'

const pKey = '_islandPromises'
let id = 1
const getId = import.meta.client ? () => (id++).toString() : randomUUID

/**
 * Translate the chunk URL the onigiri compiler baked into an island
 * AST back to a module the SSR bundle can `import()`.
 *
 * - **Build mode** — the AST carries public chunk URLs (e.g.
 *   `/_nuxt/Counter-XXX.js`). Flip them through the reverse map
 *   populated by `nitro-server/runtime/utils/renderer/build-files.ts`
 *   into the source-path keys the SSR `import.meta.glob` uses.
 * - **Dev mode** — the AST carries Vite dev URLs
 *   (`<baseURL><buildAssetsDir>/components/Counter.vue`). Strip the
 *   prefix to recover the source path.
 * - Bare source paths fall straight through to the manifest's glob.
 *
 * Client-side hydration never needs this — the browser resolves chunk
 * URLs directly via the manifest's dynamic-import fallback — so this is
 * constructed only when `import.meta.server` and threaded into
 * `renderOnigiri` as an option, replacing the older per-app Vue plugin.
 */
function makeServerOnigiriImportFn (config: ReturnType<typeof useRuntimeConfig>): ImportFn {
  const buildAssetsDir = (config.app?.buildAssetsDir || '/_nuxt/').replace(/\/$/, '') + '/'
  const baseURL = (config.app?.baseURL || '/').replace(/\/$/, '')
  const devPrefix = baseURL + buildAssetsDir
  return async (src, exportName) => {
    const reverseMap = (globalThis as { __NUXT_ONIGIRI_REVERSE_MAP__?: Record<string, string> }).__NUXT_ONIGIRI_REVERSE_MAP__
    const reversed = reverseMap?.[src]
    if (reversed) {
      return defaultOnigiriImportFn(reversed, exportName)
    }
    if (devPrefix && src.startsWith(devPrefix)) {
      return defaultOnigiriImportFn('/' + src.slice(devPrefix.length), exportName)
    }
    if (src.startsWith('/') && src.endsWith('.vue')) {
      return defaultOnigiriImportFn(src, exportName)
    }
    throw new Error(
      `[nuxt] vue-onigiri server importFn: cannot resolve "${src}". ` +
      `Expected a public chunk URL, a Vite dev URL, or a root-relative \`.vue\` source path.`,
    )
  }
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
  async setup (props, { expose, emit }) {
    const teleportKey = ref(0)
    const error = ref<unknown>(null)
    const config = useRuntimeConfig()
    const nuxtApp = useNuxtApp()
    const filteredProps = computed(() => filterIslandProps(props.props))
    const hashId = computed(() => computeIslandHash(props.name, filteredProps.value, props.context, props.source))
    const instance = getCurrentInstance()!
    const event = useRequestEvent()
    const ast = ref(nuxtApp.payload.data[`${props.name}_${hashId.value}`]?.ast)
    // Constructed once per island instance, server-only. Tree-shaken
    // out of the client bundle via the `import.meta.server` guard.
    const onigiriImportFn = import.meta.server ? makeServerOnigiriImportFn(config) : undefined
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
            : { params: { ...props.context, props: props.props ? JSON.stringify(props.props) : undefined } },
          result: toRevive,
        },
        ...result,
      }
    }

    const uid = ref<string>(useId() || getId())
    const head = injectHead()

    async function _fetchComponent (force = false) {
      const key = `${props.name}_${hashId.value}`

      if (!force && nuxtApp.payload.data[key]?.html) { return nuxtApp.payload.data[key] }

      const url = remoteComponentIslands && props.source ? joinURL(props.source, `/__nuxt_island/${key}.json`) : `/__nuxt_island/${key}.json`
      if (import.meta.server && import.meta.prerender) {
        // Hint to Nitro to prerender the island component
        nuxtApp.runWithContext(() => prerenderRoutes(url))
      }
      // TODO: Validate response
      const r = await fetch(withQuery(((import.meta.dev && import.meta.client) || props.source) ? url : joinURL(config.app.baseURL ?? '', url), {
        ...props.context,
        props: props.props ? JSON.stringify(props.props) : undefined,
      }))
      if (!r.ok) {
        throw createError({ status: r.status, statusText: r.statusText })
      }
      try {
        const result = await r.json()
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

    return () => renderOnigiri(ast.value, onigiriImportFn ? { importFn: onigiriImportFn } : undefined)
  },
})
