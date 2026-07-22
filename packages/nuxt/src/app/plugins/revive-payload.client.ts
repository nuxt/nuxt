import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { joinURL, withQuery } from 'ufo'
import { definePayloadReviver, getNuxtClientPayload } from '../composables/payload'
import { createError } from '../composables/error'
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
  ['NuxtError', data => createError(data)],
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
    if (!nuxtApp.isHydrating) {
      const url = withQuery(joinURL(useRuntimeConfig().app.baseURL ?? '', `/__nuxt_island/${key}.json`), params ?? {})
      nuxtApp.payload.data[key] ||= fetch(url).then((r) => {
        if (!r.ok) {
          throw createError({ status: r.status, statusText: r.statusText })
        }
        return r.json()
      }).then((r) => {
        nuxtApp.payload.data[key] = r
        return r
      })
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
