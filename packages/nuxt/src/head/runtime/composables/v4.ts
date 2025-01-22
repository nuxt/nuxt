import type { UseHeadInput, UseHeadOptions, UseHeadSafeInput, UseSeoMetaInput, VueHeadClient } from '@unhead/vue'
import type { ActiveHeadEntry, MergeHead } from '@unhead/schema'
import { hasInjectionContext, inject } from 'vue'
import {
  useHead as headCore,
  useHeadSafe as headSafe,
  headSymbol,
  useSeoMeta as seoMeta, useServerHead as serverHead, useServerHeadSafe as serverHeadSafe,
  useServerSeoMeta as serverSeoMeta,
} from '@unhead/vue'
import { useNuxtApp } from '#app'
import type { NuxtApp } from '#app'

/**
 * Injects the head client from the Nuxt context or Vue inject.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient<MergeHead> {
  // Nuxt 4 will throw an error if the context is missing
  const nuxt = nuxtApp || useNuxtApp()
  return nuxt.ssrContext?.head || nuxt.runWithContext(() => {
    if (hasInjectionContext()) {
      return inject<VueHeadClient<MergeHead>>(headSymbol)!
    }
  }) as VueHeadClient<MergeHead>
}

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

export function useHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> {
  const head = injectHead(options.nuxt)
  return headCore(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
}

export function useHeadSafe<T extends MergeHead> (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> {
  const head = injectHead(options.nuxt)
  return headSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> {
  const head = injectHead(options.nuxt)
  return seoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useServerHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> {
  const head = injectHead(options.nuxt)
  return serverHead(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
}

export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> {
  const head = injectHead(options.nuxt)
  return serverHeadSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useServerSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput> {
  const head = injectHead(options.nuxt)
  return serverSeoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
}
