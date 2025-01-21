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
import { tryUseNuxtApp, useNuxtApp } from '#app'
import type { NuxtApp } from '#app'
// @ts-expect-error build-time
import { isNuxt4 } from '#build/nuxt.config.mjs'

function resolveUnheadInject (): VueHeadClient<MergeHead> | undefined {
  // try use Vue inject
  if (hasInjectionContext()) {
    return inject<VueHeadClient<MergeHead>>(headSymbol)!
  }
}

/**
 * Injects the head client from the Nuxt context or Vue inject.
 *
 * In Nuxt v3 this function will not throw an error if the context is missing.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient<MergeHead> {
  // Nuxt 4 will throw an error if the context is missing
  const nuxt = nuxtApp || (isNuxt4 ? useNuxtApp() : tryUseNuxtApp())
  return nuxt?.ssrContext?.head || nuxt?.runWithContext(resolveUnheadInject) as VueHeadClient<MergeHead> || resolveUnheadInject()
}

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

export function useHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return headCore(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useHeadSafe<T extends MergeHead> (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return headSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return seoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return serverHead(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return serverHeadSafe(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput> | void {
  const head = injectHead(options.nuxt)
  if (isNuxt4 || head) {
    return serverSeoMeta(input, { head, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}
