/**
 * Extends interfaces in Vue.js
 */

import Vue, { ComponentOptions } from 'vue'
import { Route } from 'vue-router'
import { MetaInfo } from 'vue-meta'
import { Context, Middleware, Transition, NuxtApp } from './index'

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    asyncData?(ctx: Context): object | undefined
    fetch?(ctx: Context): Promise<void> | void
    head?: MetaInfo | (() => MetaInfo)
    key?: string | ((to: Route) => string)
    layout?: string | ((ctx: Context) => string)
    loading?: boolean
    middleware?: Middleware | Middleware[]
    scrollToTop?: boolean
    transition?: string | Transition | ((to: Route, from: Route) => string)
    validate?(ctx: Context): Promise<boolean> | boolean
    watchQuery?: boolean | string[]
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $nuxt: NuxtApp
  }
}
