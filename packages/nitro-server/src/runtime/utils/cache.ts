import type { Storage, StorageValue } from 'unstorage'
import { useStorage } from 'nitro/storage'
// @ts-expect-error virtual file
import { NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SHARED_DATA } from '#internal/nuxt/nitro-config.mjs'

export const payloadCache: Storage | null = import.meta.prerender
  ? useStorage<StorageValue>('internal:nuxt:prerender:payload')
  : NUXT_RUNTIME_PAYLOAD_EXTRACTION
    ? useStorage<StorageValue>('cache:nuxt:payload')
    : null
export const islandCache: Storage | null = import.meta.prerender ? useStorage<StorageValue>('internal:nuxt:prerender:island') : null
export const islandPropCache: Storage | null = import.meta.prerender ? useStorage<StorageValue>('internal:nuxt:prerender:island-props') : null
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
