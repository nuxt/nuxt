import { ServerResponse } from 'http'
import { IncomingMessage, NextFunction } from 'connect'
import Vue, { ComponentOptions } from 'vue'
import VueRouter, { Location, Route } from 'vue-router'
import { Store } from 'vuex'

import { NuxtOptions } from '../config'
import { NuxtRuntimeConfig } from '../config/runtime'

// augment typings of Vue.js
import './vue'

// augment typings of Vuex
import './vuex'

type NuxtState = Record<string, any>

export interface NuxtAppOptions extends ComponentOptions<Vue> {
  [key: string]: any // TBD
}

export interface NuxtError {
  message?: string
  path?: string
  statusCode?: number
}

export interface Context {
  $config: NuxtRuntimeConfig

  app: NuxtAppOptions
  base: string
  /**
   * @deprecated Use process.client instead
  */
  isClient: boolean
  /**
   * @deprecated Use process.server instead
  */
  isServer: boolean
  /**
   * @deprecated Use process.static instead
  */
  isStatic: boolean
  isDev: boolean
  isHMR: boolean
  route: Route
  from: Route
  store: Store<any>
  env: Record<string, any>
  params: Route['params']
  payload: any
  query: Route['query']
  next?: NextFunction
  req: IncomingMessage
  res: ServerResponse
  redirect(status: number, path: string, query?: Route['query']): void
  redirect(path: string, query?: Route['query']): void
  redirect(location: Location): void
  redirect(status: number, location: Location): void
  ssrContext?: {
    req: Context['req']
    res: Context['res']
    url: string
    target: NuxtOptions['target']
    spa?: boolean
    modern: boolean
    runtimeConfig: {
      public: NuxtRuntimeConfig
      private: NuxtRuntimeConfig
    }
    redirected: boolean
    next: NextFunction
    beforeRenderFns: Array<() => any>
    fetchCounters: Record<string, number>
    nuxt: {
      layout: string
      data: Array<Record<string, any>>
      fetch: Array<Record<string, any>>
      error: any
      state: Array<Record<string, any>>
      serverRendered: boolean
      routePath: string
      config: NuxtRuntimeConfig
    }
  }
  error(params: NuxtError): void
  nuxtState: NuxtState
  beforeNuxtRender(fn: (params: { Components: VueRouter['getMatchedComponents'], nuxtState: NuxtState }) => void): void
  enablePreview?: (previewData?: Record<string, any>) => void
  $preview?: Record<string, any>
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Middleware = string | ((ctx: Context, cb: Function) => Promise<void> | void)
export type Inject = (key: string, value: any) => void
export type Plugin = (ctx: Context, inject: Inject) => Promise<void> | void

export interface Transition {
  name?: string
  mode?: string
  css?: boolean
  duration?: number
  type?: string
  enterClass?: string
  enterToClass?: string
  enterActiveClass?: string
  leaveClass?: string
  leaveToClass?: string
  leaveActiveClass?: string
  beforeEnter?(el: HTMLElement): void
  // eslint-disable-next-line @typescript-eslint/ban-types
  enter?(el: HTMLElement, done: Function): void
  afterEnter?(el: HTMLElement): void
  enterCancelled?(el: HTMLElement): void
  beforeLeave?(el: HTMLElement): void
  // eslint-disable-next-line @typescript-eslint/ban-types
  leave?(el: HTMLElement, done: Function): void
  afterLeave?(el: HTMLElement): void
  leaveCancelled?(el: HTMLElement): void
}

export interface DefaultNuxtLoading extends Vue {
  canSucceed: boolean
  clear(): void
  continuous: boolean
  decrease(num: number): DefaultNuxtLoading
  duration: number
  fail(): DefaultNuxtLoading
  finish(): DefaultNuxtLoading
  increase(num: number): DefaultNuxtLoading
  get(): number
  hide(): DefaultNuxtLoading
  left: number
  pause(): DefaultNuxtLoading
  percent: number
  resume(): DefaultNuxtLoading
  reversed: boolean
  rtl: boolean
  set(num: number): DefaultNuxtLoading
  skipTimerCount: number
  show: boolean
  start(): DefaultNuxtLoading
  startTimer(): void
  throttle: number
}

export interface CustomNuxtLoading extends Vue {
  fail?(): CustomNuxtLoading
  finish(): CustomNuxtLoading
  increase?(num: number): CustomNuxtLoading
  pause?(): CustomNuxtLoading
  start(): CustomNuxtLoading
}

export type NuxtLoading = DefaultNuxtLoading | CustomNuxtLoading

export interface NuxtApp extends Vue {
  $options: NuxtAppOptions
  $loading: NuxtLoading
  nbFetching: number
  isFetching: boolean
  context: Context
  error(params: NuxtError): void
  isOffline: boolean
  isOnline: boolean
  layout: any // TBD
  layoutName: string
  loadLayout(layout: string): Promise<any> // TBD
  refresh(): Promise<void>
  setLayout(layout: string): any // TBD
}

// window.$nuxt
declare global {
  interface Window {
    $nuxt: NuxtApp
  }
}
