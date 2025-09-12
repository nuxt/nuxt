export type { PageMeta, CustomPageMeta, NuxtPageProps } from '../pages/runtime/index'

export interface NuxtAppLiterals {
  [key: string]: string
}

export type { NuxtRenderHTMLContext } from '../core/runtime/nitro/handlers/renderer'
export type { NuxtIslandResponse, NuxtIslandContext } from '../core/runtime/nitro/utils/renderer/islands'
