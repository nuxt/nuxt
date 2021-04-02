import type { Nuxt } from './nuxt'

declare module 'vue' {
    interface App {
        $nuxt: Nuxt
    }
}

declare global {
    interface Window {
        __NUXT__?: Record<string, any>
    }

    namespace NodeJS {
        interface Process {
          browser: boolean
          client: boolean
          mode: 'spa' | 'universal'
          modern: boolean
          server: boolean
          static: boolean
        }
    }
}
