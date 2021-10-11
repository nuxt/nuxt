import { Component } from '@vue/runtime-core'
import { NuxtApp } from '../nuxt'

declare global {
  namespace NodeJS {
    interface Process {
      browser: boolean
      client: boolean
      mode: 'spa' | 'universal'
      server: boolean
      static: boolean
    }
  }

  interface Window {
    __NUXT__?: Record<string, any>
  }
}

declare module '*.vue' {
  export default Component
}

declare module '@vue/runtime-core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface App<HostElement> {
    $nuxt: NuxtApp
  }
  interface ComponentInternalInstance {
    _nuxtOnBeforeMountCbs: Function[]
  }
}
