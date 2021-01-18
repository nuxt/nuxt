import { getCurrentInstance } from 'vue'
import type { Nuxt } from 'nuxt/app'

let currentNuxtInstance: Nuxt

export const setNuxtInstance = (nuxt: Nuxt) => {
  currentNuxtInstance = nuxt
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export async function callWithNuxt (nuxt: Nuxt, setup: () => any) {
  setNuxtInstance(nuxt)
  const p = setup()
  setNuxtInstance(undefined)
  await p
}

/**
 * Returns the current Nuxt instance.
 */
export function useNuxt () {
  const vm = getCurrentInstance()

  if (!vm && !currentNuxtInstance) {
    throw new Error('nuxt instance unavailable')
  }

  if (!vm) {
    return currentNuxtInstance
  }

  return vm.appContext.app.$nuxt
}
