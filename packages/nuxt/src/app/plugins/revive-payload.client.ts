import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { definePayloadReviver, getNuxtClientPayload } from '#app/composables/payload'
import { createError } from '#app/composables/error'
import { defineNuxtPlugin, useNuxtApp } from '#app/nuxt'
import { useAsyncData } from '#app/composables'

const revivers = {
  NuxtError: (data: any) => createError(data),
  EmptyShallowRef: (data: any) => shallowRef(data === '_' ? undefined : data === '0n' ? BigInt(0) : JSON.parse(data)),
  EmptyRef: (data: any) => ref(data === '_' ? undefined : data === '0n' ? BigInt(0) : JSON.parse(data)),
  ShallowRef: (data: any) => shallowRef(data),
  ShallowReactive: (data: any) => shallowReactive(data),
  Island: ({ key, params }: any) => {
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.data[key] = nuxtApp.payload.data[key] ||
      useAsyncData(key, () => $fetch(`/__nuxt_island/${key}`, params ? { params } : {}), { immediate: !nuxtApp.isHydrating })
    return null
  },
  Ref: (data: any) => ref(data),
  Reactive: (data: any) => reactive(data)
}

export default defineNuxtPlugin({
  name: 'nuxt:revive-payload:client',
  order: -30,
  async setup (nuxtApp) {
    for (const reviver in revivers) {
      definePayloadReviver(reviver, revivers[reviver as keyof typeof revivers])
    }
    Object.assign(nuxtApp.payload, await nuxtApp.runWithContext(getNuxtClientPayload))
    // For backwards compatibility - TODO: remove later
    window.__NUXT__ = nuxtApp.payload
  }
})
