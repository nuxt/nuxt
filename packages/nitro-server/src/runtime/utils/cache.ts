import { AsyncLocalStorage } from 'node:async_hooks'
import type { Storage, StorageValue } from 'unstorage'
import { useStorage } from 'nitro/storage'
// @ts-expect-error virtual file
import { NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

/**
 * Async-context-scoped stack of URLs the current request is rendering, oldest
 * first. Maintained by the renderer handler. A given URL appears more than
 * once in the stack only if a recursive render of it is in progress, which
 * indicates a cycle (e.g. `useFetch` in middleware against the URL it is
 * currently rendering). See https://github.com/nuxt/nuxt/issues/33871
 */
export const prerenderRenderingURLs: AsyncLocalStorage<readonly string[]> | null = import.meta.prerender ? new AsyncLocalStorage() : null

export const payloadCache: Storage | null = import.meta.prerender
  ? useStorage<StorageValue>('internal:nuxt:prerender:payload')
  : NUXT_RUNTIME_PAYLOAD_EXTRACTION
    ? useStorage<StorageValue>('cache:nuxt:payload')
    : null
export const islandCache: Storage | null = import.meta.prerender ? useStorage<StorageValue>('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage | null = import.meta.prerender ? useStorage<StorageValue>('internal:nuxt:prerender:island-props') : null
export const sharedPrerenderPromises: Map<string, Promise<any>> | null = import.meta.prerender && NUXT_SHARED_DATA ? new Map<string, Promise<any>>() : null

const sharedPrerenderKeys = new Set<string>()
// Render-chain (snapshot of `prerenderRenderingURLs.getStore()`) captured when
// each pending shared promise was inserted. Used to detect cycles where a
// `get()` from inside that chain would create a cyclic await.
const sharedPrerenderChains: Map<string, readonly string[]> | null = import.meta.prerender && NUXT_SHARED_DATA ? new Map() : null

interface SharedPrerenderCache {
  get<T = unknown>(key: string): Promise<T> | undefined
  set<T>(key: string, value: Promise<T>): Promise<void>
}

export const sharedPrerenderCache: SharedPrerenderCache | null = import.meta.prerender && NUXT_SHARED_DATA
  ? {
      get<T = unknown> (key: string): Promise<T> | undefined {
        if (!sharedPrerenderKeys.has(key)) { return }

        // Detect recursive prerender cycles where returning the cached pending
        // promise would create a cyclic await: if any URL the cached promise
        // is part of the chain for is also in the requestor's current chain,
        // the cached promise's resolution may depend on the requestor.
        // See https://github.com/nuxt/nuxt/issues/33871
        const currentChain = prerenderRenderingURLs?.getStore()
        const setChain = sharedPrerenderChains?.get(key)
        if (currentChain?.length && setChain?.length && setChain.some(url => currentChain.includes(url))) {
          return
        }
        return sharedPrerenderPromises!.get(key) ?? useStorage('internal:nuxt:prerender:shared').getItem(key) as Promise<T>
      },
      async set<T> (key: string, value: Promise<T>): Promise<void> {
        sharedPrerenderKeys.add(key)
        sharedPrerenderPromises!.set(key, value)
        const chain = prerenderRenderingURLs?.getStore()
        if (chain?.length) {
          sharedPrerenderChains!.set(key, chain)
        }
        try {
          const resolved = await value
          await useStorage('internal:nuxt:prerender:shared').setItem(key, resolved as any)
        } catch {
          // Errors are surfaced via the original promise (returned to the caller
          // through `get`); the shared cache itself only persists resolved values.
        } finally {
          sharedPrerenderPromises!.delete(key)
          sharedPrerenderChains?.delete(key)
        }
      },
    }
  : null
