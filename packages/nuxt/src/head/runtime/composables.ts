import type { ActiveHeadEntry, UseHeadInput, UseHeadOptions, UseHeadSafeInput, UseSeoMetaInput, VueHeadClient } from '@unhead/vue/types'
import { hasInjectionContext, inject } from 'vue'
import {
  useHead as headCore,
  useHeadSafe as headSafe,
  headSymbol,
  useSeoMeta as seoMeta, useServerHead as serverHead, useServerHeadSafe as serverHeadSafe,
  useServerSeoMeta as serverSeoMeta,
} from '@unhead/vue'
import { useNuxtApp } from '#app/nuxt'
import type { NuxtApp } from '#app/nuxt'

/**
 * Injects the head client from the Nuxt context or Vue inject.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient {
  // Nuxt 4 will throw an error if the context is missing
  const nuxt = nuxtApp || useNuxtApp()
  return nuxt.ssrContext?.head || nuxt.runWithContext(() => {
    if (hasInjectionContext()) {
      const head = inject<VueHeadClient>(headSymbol)
      // should not be possible
      if (!head) {
        throw new Error('[nuxt] [unhead] Missing Unhead instance.')
      }
      return head
    }
  }) as VueHeadClient
}

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

export function useHead (input: UseHeadInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput> {
  const head = options.head || injectHead(options.nuxt)
  return headCore(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadSafeInput> {
  const head = options.head || injectHead(options.nuxt)
  return headSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadSafeInput>
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> {
  const head = options.head || injectHead(options.nuxt)
  return seoMeta(input, { head, ...options }) as ActiveHeadEntry<UseSeoMetaInput>
}

/**
 * @deprecated Use `useHead` instead and wrap with `if (import.meta.server)`
 */
export function useServerHead (input: UseHeadInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput> {
  const head = options.head || injectHead(options.nuxt)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return serverHead(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}

/**
 * @deprecated Use `useHeadSafe` instead and wrap with `if (import.meta.server)`
 */
export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadSafeInput> {
  const head = options.head || injectHead(options.nuxt)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return serverHeadSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadSafeInput>
}

/**
 * @deprecated Use `useSeoMeta` instead and wrap with `if (import.meta.server)`
 */
export function useServerSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> {
  const head = options.head || injectHead(options.nuxt)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return serverSeoMeta(input, { head, ...options }) as ActiveHeadEntry<UseSeoMetaInput>
}
