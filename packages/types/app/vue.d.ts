/**
 * Extends interfaces in Vue.js
 */

import Vue from 'vue'
import { MetaInfo } from 'vue-meta'
import { Route } from 'vue-router'
import { Context, Middleware, Transition, NuxtApp } from './index'
import { NuxtRuntimeConfig } from '../config/runtime'

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    asyncData?(ctx: Context): Promise<object | void> | object | void
    fetch?(ctx: Context): Promise<void> | void
    fetchDelay?: number
    fetchOnServer?: boolean | (() => boolean)
    head?: MetaInfo | (() => MetaInfo)
    key?: string | ((to: Route) => string)
    layout?: string | ((ctx: Context) => string)
    loading?: boolean
    middleware?: Middleware | Middleware[]
    scrollToTop?: boolean
    transition?: string | Transition | ((to: Route, from: Route | undefined) => string | Transition)
    validate?(ctx: Context): Promise<boolean> | boolean
    watchQuery?: boolean | string[] | ((newQuery: Route['query'], oldQuery: Route['query']) => boolean)
    meta?: { [key: string]: any }
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $config: NuxtRuntimeConfig
    $nuxt: NuxtApp
    $fetch(): void
    $fetchState: {
      error: Error | null
      pending: boolean
      timestamp: number
    }
  }
}
