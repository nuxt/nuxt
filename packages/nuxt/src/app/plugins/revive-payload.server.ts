import { isShallow, isRef, isReactive, toRaw } from 'vue'
import { definePayloadReducer } from '#app/composables/payload'
import { isNuxtError } from '#app/composables/error'
import { defineNuxtPlugin } from '#app/nuxt'
/* Defining a plugin that will be used by the Nuxt framework. */

const reducers = {
  NuxtError: (data: any) => isNuxtError(data) && data.toJSON(),
  shallowRef: (data: any) => isRef(data) && isShallow(data) && data.value,
  ref: (data: any) => isRef(data) && data.value,
  reactive: (data: any) => isReactive(data) && toRaw(data)
}

export default defineNuxtPlugin(() => {
  for (const reducer in reducers) {
    definePayloadReducer(reducer, reducers[reducer as keyof typeof reducers])
  }
})
