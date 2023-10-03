import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import destr from 'destr'
import { definePayloadReviver, getNuxtClientPayload } from '#app/composables/payload'
import { createError } from '#app/composables/error'
import { defineNuxtPlugin, useNuxtApp } from '#app/nuxt'

// @ts-expect-error Virtual file.
import { componentIslands } from '#build/nuxt.config.mjs'

const revivers: Record<string, (data: any) => any> = {
  NuxtError: data => createError(data),
  EmptyShallowRef: data => shallowRef(data === '_' ? undefined : data === '0n' ? BigInt(0) : destr(data)),
  EmptyRef: data => ref(data === '_' ? undefined : data === '0n' ? BigInt(0) : destr(data)),
  ShallowRef: data => shallowRef(data),
  ShallowReactive: data => shallowReactive(data),
  Ref: data => ref(data),
  Reactive: data => reactive(data)
}

if (componentIslands) {
  revivers.Island = ({ key, params }: any) => {
    const nuxtApp = useNuxtApp()
    if (!nuxtApp.isHydrating) {
      nuxtApp.payload.data[key] = nuxtApp.payload.data[key] || $fetch(`/__nuxt_island/${key}`, {
        responseType: 'json',
        ...params ? { params } : {}
      }).then((r) => {
        nuxtApp.payload.data[key] = r
        return r
      })
    }
    return null
  }
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
