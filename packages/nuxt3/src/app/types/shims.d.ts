// eslint-disable-next-line import/default
import Vue from 'vue'
import { $Fetch } from 'ohmyfetch'
import { Nuxt } from '../dist'

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
  export default Vue
}

declare module 'vue' {
  interface App {
    $nuxt: Nuxt
  }
}
