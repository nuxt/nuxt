import { isReactive, isRef, isShallow, toRaw } from 'vue'
import { definePayloadReducer } from '../composables/payload'
import { isNuxtError } from '../composables/error'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

import { componentIslands } from '#build/nuxt.config.mjs'
import { isValidIslandKey } from './utils'

const isObject = (data: unknown): data is object => typeof data === 'object' && data !== null

const reducers: [string, (data: any) => any][] = [
  ['NuxtError', data => isNuxtError(data) && data.toJSON()],
  ['EmptyShallowRef', data => isObject(data) && isRef(data) && isShallow(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_'))],
  ['EmptyRef', data => isObject(data) && isRef(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_'))],
  ['ShallowRef', data => isObject(data) && isRef(data) && isShallow(data) && data.value],
  ['ShallowReactive', data => isObject(data) && isReactive(data) && isShallow(data) && toRaw(data)],
  ['Ref', data => isObject(data) && isRef(data) && data.value],
  ['Reactive', data => isObject(data) && isReactive(data) && toRaw(data)],
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
