import { reactive, ref, shallowRef } from 'vue'
import { definePayloadReviver, getNuxtClientPayload } from '#app/composables/payload'
import { createError } from '#app/composables/error'
import { callWithNuxt, defineNuxtPlugin } from '#app/nuxt'

const revivers = {
  NuxtError: (data: any) => createError(data),
  shallowRef: (data: any) => shallowRef(data),
  ref: (data: any) => ref(data),
  reactive: (data: any) => reactive(data)
}

export default defineNuxtPlugin(async (nuxtApp) => {
  for (const reviver in revivers) {
    definePayloadReviver(reviver, revivers[reviver as keyof typeof revivers])
  }
  Object.assign(nuxtApp.payload, await callWithNuxt(nuxtApp, getNuxtClientPayload, []))
  // For backwards compatibility - TODO: remove later
  window.__NUXT__ = nuxtApp.payload
})
