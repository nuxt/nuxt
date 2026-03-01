// Workaround for 'The inferred type of 'payloadCache' cannot be named without a reference to '.pnpm/unstorage@1.16.0_db0@0.3.2_ioredis@5.6.1/node_modules/unstorage'.
// This is likely not portable. A type annotation is necessary.
import type { Storage } from 'unstorage'
import { createStorage } from 'unstorage'
import { useStorage } from 'nitropack/runtime'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
// @ts-expect-error virtual file
import { NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

export const payloadCache: Storage | null = import.meta.prerender
  ? useStorage('internal:nuxt:prerender:payload')
  : NUXT_RUNTIME_PAYLOAD_EXTRACTION
    ? createStorage({ driver: lruCacheDriver({ max: 100, ttl: 30_000 }) })
    : null
export const islandCache: Storage | null = import.meta.prerender ? useStorage('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage | null = import.meta.prerender ? useStorage('internal:nuxt:prerender:island-props') : null
export const sharedPrerenderPromises: Map<string, Promise<any>> | null = import.meta.prerender && NUXT_SHARED_DATA ? new Map<string, Promise<any>>() : null

const sharedPrerenderKeys = new Set<string>()

interface SharedPrerenderCache {
  get<T = unknown>(key: string): Promise<T> | undefined
  set<T>(key: string, value: Promise<T>): Promise<void>
}

export const sharedPrerenderCache: SharedPrerenderCache | null = import.meta.prerender && NUXT_SHARED_DATA
  ? {
      get<T = unknown> (key: string): Promise<T> | undefined {
        if (sharedPrerenderKeys.has(key)) {
          return sharedPrerenderPromises!.get(key) ?? useStorage('internal:nuxt:prerender:shared').getItem(key) as Promise<T>
        }
      },
      async set<T> (key: string, value: Promise<T>): Promise<void> {
        sharedPrerenderKeys.add(key)
        sharedPrerenderPromises!.set(key, value)
        useStorage('internal:nuxt:prerender:shared').setItem(key, await value as any)
        // free up memory after the promise is resolved
          .finally(() => sharedPrerenderPromises!.delete(key))
      },
    }
  : null
