/// <reference path="./build-only.d.ts" />

import type { UseHeadInput } from '@unhead/vue/types'
import type { NuxtApp, useNuxtApp } from '../nuxt'

declare global {
  interface ImportMeta {
    browser: boolean
    client: boolean
    dev: boolean
    envName: string
    server: boolean
    test: boolean
  }

  interface Window {
    __NUXT__?: Record<string, any> | Record<string, Record<string, any>>
    useNuxtApp?: typeof useNuxtApp
  }
}

declare module 'vue' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface App<HostElement> {
    $nuxt: NuxtApp
  }
  interface ComponentCustomProperties {
    $nuxt: NuxtApp
  }
  interface ComponentInternalInstance {
    _nuxtOnBeforeMountCbs: Array<() => void | Promise<void>>
    _nuxtIdIndex?: Record<string, number>
    _nuxtClientOnly?: boolean
  }
  interface ComponentCustomOptions {
    /**
     * Available exclusively for `defineNuxtComponent`.
     * It will not be executed when using `defineComponent`.
     */
    head?(nuxtApp: NuxtApp): UseHeadInput
  }
}

export type _NuxtAugmentsAnchor = NuxtApp
