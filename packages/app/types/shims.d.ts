declare global {
    import type { $Fetch } from 'ohmyfetch'

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
    import Vue from 'vue'
    export default Vue
}

declare module 'vue' {
    import type { Nuxt } from '../dist'

    interface App {
        $nuxt: Nuxt
    }
}
