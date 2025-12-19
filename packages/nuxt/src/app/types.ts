import type { SerializableHead } from '@unhead/vue'

export type { PageMeta, NuxtPageProps } from '../pages/runtime/index'

export interface NuxtAppLiterals {
  [key: string]: string
}

export interface NuxtIslandSlotResponse {
  props: Array<unknown>
  fallback?: string
}

export interface NuxtIslandClientResponse {
  html: string
  props: unknown
  chunk: string
  slots?: Record<string, string>
}

export interface NuxtIslandContext {
  id?: string
  name: string
  props?: Record<string, any>
  url: string
  slots: Record<string, Omit<NuxtIslandSlotResponse, 'fallback'>>
  components: Record<string, Omit<NuxtIslandClientResponse, 'html'>>
}

export interface NuxtIslandResponse {
  id?: string
  html: string
  head: SerializableHead
  props?: Record<string, Record<string, any>>
  components?: Record<string, NuxtIslandClientResponse>
  slots?: Record<string, NuxtIslandSlotResponse>
}

export interface NuxtRenderHTMLContext {
  htmlAttrs: string[]
  head: string[]
  bodyAttrs: string[]
  bodyPrepend: string[]
  body: string[]
  bodyAppend: string[]
}
