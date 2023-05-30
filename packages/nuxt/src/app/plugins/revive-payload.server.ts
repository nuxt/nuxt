import { isReactive, isRef, isShallow, toRaw } from 'vue'
import { definePayloadReducer } from '#app/composables/payload'
import { isNuxtError } from '#app/composables/error'
import { defineNuxtPlugin } from '#app/nuxt'
/* Defining a plugin that will be used by the Nuxt framework. */

const reducers = {
  NuxtError: (data: any) => isNuxtError(data) && data.toJSON(),
  EmptyShallowRef: (data: any) => isRef(data) && isShallow(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_')),
  EmptyRef: (data: any) => isRef(data) && !data.value && (typeof data.value === 'bigint' ? '0n' : (JSON.stringify(data.value) || '_')),
  ShallowRef: (data: any) => isRef(data) && isShallow(data) && data.value,
  ShallowReactive: (data: any) => isReactive(data) && isShallow(data) && toRaw(data),
  Ref: (data: any) => isRef(data) && data.value,
  Reactive: (data: any) => isReactive(data) && toRaw(data)
}

export default defineNuxtPlugin({
  name: 'nuxt:revive-payload:server',
  setup () {
    for (const reducer in reducers) {
      definePayloadReducer(reducer, reducers[reducer as keyof typeof reducers])
    }
  }
})
