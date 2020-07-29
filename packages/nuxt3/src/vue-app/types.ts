import type { Nuxt } from './nuxt';

export interface Plugin {
    (nuxt: Nuxt, inject?: Nuxt['provide']): Promise<void> | void
}
