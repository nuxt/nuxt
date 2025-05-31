import { useStorage } from 'nitropack/runtime'

export const payloadCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:payload') : null
export const islandCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:island') : null
export const islandPropCache = import.meta.prerender ? useStorage('internal:nuxt:prerender:island-props') : null
export const sharedPrerenderPromises = import.meta.prerender && process.env.NUXT_SHARED_DATA ? new Map<string, Promise<any>>() : null

const sharedPrerenderKeys = new Set<string>()
export const sharedPrerenderCache = import.meta.prerender && process.env.NUXT_SHARED_DATA
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
