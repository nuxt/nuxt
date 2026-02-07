import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import destr from 'destr'
import { definePayloadReviver, getNuxtClientPayload } from '../composables/payload'
import { createError } from '../composables/error'
import { getRouteRules } from '../composables/manifest'
import { useRoute } from '../composables/router'
import { defineNuxtPlugin, useNuxtApp } from '../nuxt'

// @ts-expect-error Virtual file.
import { componentIslands } from '#build/nuxt.config.mjs'

const revivers: [string, (data: any) => any][] = [
  ['NuxtError', data => createError(data)],
  ['EmptyShallowRef', data => shallowRef(data === '_' ? undefined : data === '0n' ? BigInt(0) : destr(data))],
  ['EmptyRef', data => ref(data === '_' ? undefined : data === '0n' ? BigInt(0) : destr(data))],
  ['ShallowRef', data => shallowRef(data)],
  ['ShallowReactive', data => shallowReactive(data)],
  ['Ref', data => ref(data)],
  ['Reactive', data => reactive(data)],
]

if (componentIslands) {
  revivers.push(['Island', ({ key, params, result }: any) => {
    const nuxtApp = useNuxtApp()
    if (!nuxtApp.isHydrating) {
      const rules = getRouteRules({ path: useRoute().path })
      const shouldCache = rules.prerender || rules.cache
      if (shouldCache) {
        // Prerendered/cached routes: memory cache (bounded set)
        nuxtApp.payload.data[key] ||= $fetch(`/__nuxt_island/${key}.json`, {
          responseType: 'json',
          ...params ? { params } : {},
        }).then((r) => {
          nuxtApp.payload.data[key] = { __cached: true, ...r as Record<string, unknown> }
          return nuxtApp.payload.data[key]
        })
      }
      // Dynamic routes: no memory cache (rely on browser HTTP cache)
    }
    const cached = nuxtApp.payload.data[key]
    // Reuse cached island data with html on navigation back (#33809)
    if (cached?.html) {
      cached.__cached = true
      return cached
    }
    return {
      html: '',
      __cached: true,
      ...result,
    }
  }])
}

export default defineNuxtPlugin({
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
