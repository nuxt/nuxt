import { isReactive, isRef, isShallow, toRaw } from 'vue'
import { definePayloadReducer } from '../composables/payload'
import { isNuxtError } from '../composables/error'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

import { componentIslands } from '#build/nuxt.config.mjs'
import { isValidIslandKey } from './utils'

/** @internal */
export const reducers: [string, (data: any) => any][] = [
  // `toJSON` carries only what belongs in an HTTP error body, so `fatal` and
  // the dev stack are added back or they are lost on revival (#29182). Plain
  // objects carrying the signature fall through to ordinary serialisation,
  // which keeps every field they were sent with.
  ['NuxtError', (data) => {
    if (!isNuxtError(data) || typeof data.toJSON !== 'function') { return false }
    return {
      ...data.toJSON(),
      ...data.fatal !== !!data.unhandled && { fatal: data.fatal },
      ...import.meta.dev && data.stack && { stack: data.stack },
    }
  }],
  ['EmptyShallowRef', data => isRef(data) && isShallow(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_'))],
  ['EmptyRef', data => isRef(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_'))],
  ['ShallowRef', data => isRef(data) && isShallow(data) && data.value],
  ['ShallowReactive', data => isReactive(data) && isShallow(data) && toRaw(data)],
  ['Ref', data => isRef(data) && data.value],
  ['Reactive', data => isReactive(data) && toRaw(data)],
]

if (componentIslands) {
  reducers.push(['Island', data => data && data?.__nuxt_island && isValidIslandKey(data.__nuxt_island.key) && data.__nuxt_island])
}

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:revive-payload:server',
  setup () {
    for (const [reducer, fn] of reducers) {
      definePayloadReducer(reducer, fn)
    }
  },
})

export default plugin
