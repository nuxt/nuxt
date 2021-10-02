import { Component } from '@vue/runtime-core'
import { $Fetch } from 'ohmyfetch'
import { NuxtApp } from '../nuxt'

declare global {
  // eslint-disable-next-line no-var
  var $fetch: $Fetch

  namespace NodeJS {
    interface Global {
      $fetch: $Fetch
    }
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
}
