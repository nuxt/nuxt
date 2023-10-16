import type { NuxtApp, useNuxtApp } from '../nuxt'

interface NuxtStaticBuildFlags {
  browser: boolean
  client: boolean
  dev: boolean
  server: boolean
  test: boolean
}

declare global {
  namespace NodeJS {
    interface Process extends NuxtStaticBuildFlags {}
  }

  interface ImportMeta extends NuxtStaticBuildFlags {}

  interface Window {
    __NUXT__?: Record<string, any>
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
    _nuxtOnBeforeMountCbs: Function[]
  }
}
