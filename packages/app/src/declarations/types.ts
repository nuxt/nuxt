import { Nuxt } from '@nuxt/app'

declare module 'vue' {
    interface App {
        $nuxt: Nuxt
    }
}
