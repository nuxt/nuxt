import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { joinURL, withQuery } from 'ufo'
import { definePayloadReviver, getNuxtClientPayload } from '../composables/payload'
import { createError } from '../composables/error'
import { defineNuxtPlugin, useNuxtApp, useRuntimeConfig } from '../nuxt'
import { usePrefetchScheduler } from '../internal/prefetch-scheduler'
import type { ObjectPlugin, Plugin } from '../nuxt'

import { componentIslands } from '#build/nuxt.config.mjs'

function parseRevivedData (data: string) {
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

const revivers: [string, (data: any) => any][] = [
  ['NuxtError', (data) => {
    const error = createError(data)
    if (import.meta.dev && data?.stack) { error.stack = data.stack }
    return error
  }],
  ['EmptyShallowRef', data => shallowRef(data === '_' ? undefined : data === '0n' ? BigInt(0) : parseRevivedData(data))],
  ['EmptyRef', data => ref(data === '_' ? undefined : data === '0n' ? BigInt(0) : parseRevivedData(data))],
  ['ShallowRef', data => shallowRef(data)],
  ['ShallowReactive', data => shallowReactive(data)],
  ['Ref', data => ref(data)],
  ['Reactive', data => reactive(data)],
]

if (componentIslands) {
  revivers.push(['Island', ({ key, params, result }: any) => {
    const nuxtApp = useNuxtApp()
    if (!nuxtApp.isHydrating && !nuxtApp.payload.data[key]) {
      const url = withQuery(joinURL(useRuntimeConfig().app.baseURL ?? '', `/__nuxt_island/${key}.json`), params ?? {})
      // an island-heavy payload has one of these per island, and each is a server render
      // rather than a static asset
      const promise = new Promise((resolve, reject) => {
        usePrefetchScheduler(nuxtApp).schedule({
          key: `island:${key}`,
          priority: 'island',
          scope: 'app',
          run: (signal) => {
            // `<NuxtIsland>` fetches for itself if it mounts before this runs
            if (nuxtApp.payload.data[key] !== promise) { return resolve(nuxtApp.payload.data[key]) }
            return fetch(url, { signal }).then((r) => {
              if (!r.ok) {
                throw createError({ status: r.status, statusText: r.statusText })
              }
              return r.json()
            }).then((r) => {
              nuxtApp.payload.data[key] = r
              resolve(r)
            }, (error) => {
              // allow a later prefetch to retry
              if (nuxtApp.payload.data[key] === promise) {
                delete nuxtApp.payload.data[key]
              }
              reject(error)
            })
          },
        })
      })
      // an unobserved rejection here is not an app error; `<NuxtIsland>` refetches on mount
      promise.catch(() => {})
      nuxtApp.payload.data[key] = promise
    }
    return {
      html: '',
      ...result,
    }
  }])
}

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:revive-payload:client',
  order: -30,
  async setup (nuxtApp) {
    for (const [reviver, fn] of revivers) {
      definePayloadReviver(reviver, fn)
    }
    Object.assign(nuxtApp.payload, await nuxtApp.runWithContext(getNuxtClientPayload))
    delete window.__NUXT__
  },
})

export default plugin
