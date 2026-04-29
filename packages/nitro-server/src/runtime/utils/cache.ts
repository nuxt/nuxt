import { AsyncLocalStorage } from 'node:async_hooks'
// Workaround for 'The inferred type of 'payloadCache' cannot be named without a reference to '.pnpm/unstorage@1.16.0_db0@0.3.2_ioredis@5.6.1/node_modules/unstorage'.
// This is likely not portable. A type annotation is necessary.
import type { Storage } from 'unstorage'
import { useStorage } from 'nitropack/runtime'
// @ts-expect-error virtual file
import { NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

/**
 * Stack of URLs currently rendering in the active async context (oldest first).
 * A repeated entry signals a render cycle.
 */
export const prerenderRenderingURLs: AsyncLocalStorage<readonly string[]> | null = import.meta.prerender ? new AsyncLocalStorage() : null

export const payloadCache: Storage | null = import.meta.prerender
  ? useStorage('internal:nuxt:prerender:payload')
  : NUXT_RUNTIME_PAYLOAD_EXTRACTION
    ? useStorage('cache:nuxt:payload')
    : null
export const islandCache: Storage | null = import.meta.prerender ? useStorage('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage | null = import.meta.prerender ? useStorage('internal:nuxt:prerender:island-props') : null
export const sharedPrerenderPromises: Map<string, Promise<any>> | null = import.meta.prerender && NUXT_SHARED_DATA ? new Map<string, Promise<any>>() : null

const sharedPrerenderKeys = new Set<string>()
// Render chain in flight when each pending shared promise was inserted,
// used to detect cyclic awaits in `get()`.
const sharedPrerenderChains: Map<string, readonly string[]> | null = import.meta.prerender && NUXT_SHARED_DATA ? new Map() : null

interface SharedPrerenderCache {
  get<T = unknown>(key: string): Promise<T> | undefined
  set<T>(key: string, value: Promise<T>): Promise<void>
}

export const sharedPrerenderCache: SharedPrerenderCache | null = import.meta.prerender && NUXT_SHARED_DATA
  ? {
      get<T = unknown> (key: string): Promise<T> | undefined {
        if (!sharedPrerenderKeys.has(key)) { return }

        // Skip a pending entry whose render chain overlaps the caller's.
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
          // Rejections propagate through the original promise; only resolved values are persisted.
        } finally {
          sharedPrerenderPromises!.delete(key)
          sharedPrerenderChains?.delete(key)
        }
      },
    }
  : null
