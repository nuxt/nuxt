import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { joinURL, withQuery } from 'ufo'
import { definePayloadReviver, getNuxtClientPayload, isCachedPayloadRoute, shouldLoadPayload } from '../composables/payload'
import { createError } from '../composables/error'
import { useRoute } from '../composables/router'
import { defineNuxtPlugin, useNuxtApp, useRuntimeConfig } from '../nuxt'
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
  revivers.push(['Island', ({ key, path, params, result }: any) => {
    const nuxtApp = useNuxtApp()
    const routePath = path || useRoute().path
    if (!nuxtApp.isHydrating) {
      const fetchIsland = (shouldCache: boolean) => {
        const url = withQuery(joinURL(useRuntimeConfig().app.baseURL ?? '', `/__nuxt_island/${key}.json`), params ?? {})
        const cache = shouldCache
          ? isCachedPayloadRoute(routePath) ? 'default' : 'force-cache'
          : undefined
        void fetch(url, cache ? { cache } : {}).then((r) => {
          if (!r.ok) {
            throw createError({ status: r.status, statusText: r.statusText })
          }
          return r.json()
        }).catch(() => {})
      }
      void shouldLoadPayload(routePath).then(fetchIsland).catch(() => fetchIsland(false))
    }
    const cached = nuxtApp.payload.data[key]
    if (cached?.html) {
      return cached
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
