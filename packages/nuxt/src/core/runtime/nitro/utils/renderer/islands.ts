import type { SerializableHead } from '@unhead/vue/types' 

   export interface NuxtIslandSlotResponse {
  props: Array<unknown>
  fallback?: string
}

export interface NuxtIslandContext {
  id?: string
  name: string
  props?: Record<string, any>
  url: string
  slots: Record<string, Omit<NuxtIslandSlotResponse, 'html' | 'fallback'>>
  components: Record<string, Omit<NuxtIslandClientResponse, 'html'>>
}

export interface NuxtIslandResponse {
  id?: string 
  head: SerializableHead 
  ast: any
}

export interface NuxtIslandClientResponse {
  html: string
  props: unknown
  chunk: string
  slots?: Record<string, string>
}
