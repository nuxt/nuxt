import type { ActiveHeadEntry, MergeHead } from '@unhead/schema'
import type { UseHeadInput, UseHeadOptions, UseHeadSafeInput, UseSeoMetaInput, VueHeadClient } from '@unhead/vue'
import { useHead as head, useHeadSafe as headSafe, injectHead as inject, useSeoMeta as seoMeta, useServerHead as serverHead, useServerHeadSafe as serverHeadSafe, useServerSeoMeta as serverSeoMeta } from '@unhead/vue'
import type { NuxtApp } from 'nuxt/app'
import { useNuxtApp } from 'nuxt/app'

export * from '@unhead/vue'

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

/**
 * Injects the head client from the Nuxt context or Vue inject.
 *
 * In Nuxt v3 this function will not throw an error if the context is missing.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient<MergeHead> {
  const nuxt = nuxtApp || useNuxtApp()
  if (nuxt?.ssrContext?.head) {
    return nuxt?.ssrContext?.head
  }
  if (nuxt) {
    return nuxt.runWithContext(inject) as VueHeadClient<MergeHead>
  }
  // try use Vue inject
  return inject()
}

export function useHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  return head(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
}

export function useHeadSafe<T extends MergeHead> (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  return headSafe(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const unhead = injectHead(options.nuxt)
  return seoMeta(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useServerHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  return serverHead(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
}

export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const unhead = injectHead(options.nuxt)
  return serverHeadSafe(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
}

export function useServerSeoMeta<T extends MergeHead> (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  return serverSeoMeta(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
}
