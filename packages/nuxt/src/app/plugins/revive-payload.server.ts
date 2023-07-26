import { isReactive, isRef, isShallow, toRaw } from 'vue'
import { definePayloadReducer } from '#app/composables/payload'
import { isNuxtError } from '#app/composables/error'
import { defineNuxtPlugin } from '#app/nuxt'

// @ts-expect-error Virtual file.
import { componentIslands } from '#build/nuxt.config.mjs'

const reducers: Record<string, (data: any) => any> = {
  NuxtError: data => isNuxtError(data) && data.toJSON(),
  EmptyShallowRef: data => isRef(data) && isShallow(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_')),
  EmptyRef: data => isRef(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_')),
  ShallowRef: data => isRef(data) && isShallow(data) && data.value,
  ShallowReactive: data => isReactive(data) && isShallow(data) && toRaw(data),
  Ref: data => isRef(data) && data.value,
  Reactive: data => isReactive(data) && toRaw(data)
}

if (componentIslands) {
  reducers.Island = data => data && data?.__nuxt_island
}

export default defineNuxtPlugin({
  name: 'nuxt:revive-payload:server',
  setup () {
    for (const reducer in reducers) {
      definePayloadReducer(reducer, reducers[reducer as keyof typeof reducers])
    }
  }
})
