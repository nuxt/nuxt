import type { ActiveHeadEntry, MergeHead, UseHeadInput, UseHeadOptions, UseHeadSafeInput, UseSeoMetaInput, VueHeadClient } from '@unhead/vue'
import { hasInjectionContext, inject } from 'vue'
import {
  useHead as headCore,
  useHeadSafe as headSafe,
  headSymbol,
  useSeoMeta as seoMeta, useServerHead as serverHead, useServerHeadSafe as serverHeadSafe,
  useServerSeoMeta as serverSeoMeta,
} from '@unhead/vue'
import { tryUseNuxtApp } from '#app/nuxt'
import type { NuxtApp } from '#app/nuxt'

/**
 * Injects the head client from the Nuxt context or Vue inject.
 *
 * In Nuxt v3 this function will not throw an error if the context is missing.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient<MergeHead> {
  // Nuxt 4 will throw an error if the context is missing
  const nuxt = nuxtApp || tryUseNuxtApp()
  return nuxt?.ssrContext?.head || nuxt?.runWithContext(() => {
    if (hasInjectionContext()) {
      return inject<VueHeadClient<MergeHead>>(headSymbol)!
    }
  }) as VueHeadClient<MergeHead>
}

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

export function useHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return headCore(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useHeadSafe<T extends MergeHead> (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return headSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return seoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return serverHead(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return serverHeadSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput> | void {
  const head = injectHead(options.nuxt)
  if (head) {
    return serverSeoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}
