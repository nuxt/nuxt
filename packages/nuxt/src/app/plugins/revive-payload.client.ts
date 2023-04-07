import { reactive, ref, shallowRef, shallowReactive } from 'vue'
import { definePayloadReviver, getNuxtClientPayload } from '#app/composables/payload'
import { createError } from '#app/composables/error'
import { callWithNuxt, defineNuxtPlugin } from '#app/nuxt'

const revivers = {
  NuxtError: (data: any) => createError(data),
  EmptyShallowRef: (data: any) => shallowRef(JSON.parse(data)),
  EmptyRef: (data: any) => ref(JSON.parse(data)),
  ShallowRef: (data: any) => shallowRef(data),
  ShallowReactive: (data: any) => shallowReactive(data),
  Ref: (data: any) => ref(data),
  Reactive: (data: any) => reactive(data)
}

export default defineNuxtPlugin(async (nuxtApp) => {
  for (const reviver in revivers) {
    definePayloadReviver(reviver, revivers[reviver as keyof typeof revivers])
  }
  Object.assign(nuxtApp.payload, await callWithNuxt(nuxtApp, getNuxtClientPayload, []))
  // For backwards compatibility - TODO: remove later
  window.__NUXT__ = nuxtApp.payload
})
