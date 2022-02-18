import { NuxtApp } from '../nuxt'

declare global {
  namespace NodeJS {
    interface Process {
      browser: boolean
      client: boolean
      dev: boolean
      mode: 'spa' | 'universal'
      server: boolean
      static: boolean
    }
  }

  interface Window {
    __NUXT__?: Record<string, any>
  }
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
