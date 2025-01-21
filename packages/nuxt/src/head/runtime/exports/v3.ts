import type { ActiveHeadEntry, MergeHead } from '@unhead/schema'
import type { UseHeadInput, UseHeadOptions, UseHeadSafeInput, UseSeoMetaInput,
  VueHeadClient } from '@unhead/vue'
import {
  useHead as head,
  useHeadSafe as headSafe,
  useSeoMeta as seoMeta,
  useServerHead as serverHead,
  useServerHeadSafe as serverHeadSafe,
  useServerSeoMeta as serverSeoMeta,
} from '@unhead/vue'
import type { UseScriptInput, UseScriptOptions, UseScriptReturn } from '@unhead/vue/legacy'
import {
  injectHead as inject,
  useScript as script,
} from '@unhead/vue/legacy'
import { tryUseNuxtApp } from '#app'
import type { NuxtApp } from '#app'

export * from '@unhead/vue/legacy'

interface NuxtUseHeadOptions extends UseHeadOptions {
  nuxt?: NuxtApp
}

/**
 * Injects the head client from the Nuxt context or Vue inject.
 *
 * In Nuxt v3 this function will not throw an error if the context is missing.
 */
export function injectHead (nuxtApp?: NuxtApp): VueHeadClient<MergeHead> | undefined {
  const nuxt = nuxtApp || tryUseNuxtApp()
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
  if (unhead) {
    return head(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useHeadSafe<T extends MergeHead> (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  if (unhead) {
    return headSafe(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useSeoMeta (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const unhead = injectHead(options.nuxt)
  if (unhead) {
    return seoMeta(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerHead<T extends MergeHead> (input: UseHeadInput<T>, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  if (unhead) {
    return serverHead(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput<T>>
  }
}

export function useServerHeadSafe (input: UseHeadSafeInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseSeoMetaInput> | void {
  const unhead = injectHead(options.nuxt)
  if (unhead) {
    return serverHeadSafe(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

export function useServerSeoMeta<T extends MergeHead> (input: UseSeoMetaInput, options: NuxtUseHeadOptions = {}): ActiveHeadEntry<UseHeadInput<T>> | void {
  const unhead = injectHead(options.nuxt)
  if (unhead) {
    return serverSeoMeta(input, { head: unhead, ...options }) as ActiveHeadEntry<UseHeadInput>
  }
}

/**
 * Aliased for users doing `import { useScript } from '@unhead/vue'`
 * @deprecated This will be removed in Nuxt v4. Use `useScript` exported from `@unhead/scripts/vue`
 */
export function useScript<T extends Record<symbol | string, any> = Record<symbol | string, any>> (input: UseScriptInput, options?: UseScriptOptions<T> & { nuxt?: NuxtApp }): UseScriptReturn<T> | void {
  const unhead = injectHead(options?.nuxt)
  return script(input, { head: unhead, ...options })
}
