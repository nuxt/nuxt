import Vue, { ComponentOptions } from 'vue'
import VueRouter, { Route } from 'vue-router'
import { Store } from 'vuex'
import { IncomingMessage, ServerResponse } from 'http'

// augment typings of NodeJS.Process
import './process'

// augment typings of Vue.js
import './vue'

type Dictionary<T> = { [key: string]: T }

type NuxtState = Dictionary<any>

export interface Context {
  app: NuxtAppOptions
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
  store: Store<any>
  env: Dictionary<any>
  params: Route['params']
  payload: any
  query: Route['query']
  req: IncomingMessage
  res: ServerResponse
  redirect(status: number, path: string, query?: Route['query']): void
  redirect(path: string, query?: Route['query']): void
  error(params: ErrorParams): void
  nuxtState: NuxtState
  beforeNuxtRender(fn: (params: { Components: VueRouter['getMatchedComponents'], nuxtState: NuxtState }) => void): void
}

export type Middleware = string | ((ctx: Context, cb: Function) => Promise<void> | void)

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
  enter?(el: HTMLElement, done: Function): void
  afterEnter?(el: HTMLElement): void
  enterCancelled?(el: HTMLElement): void
  beforeLeave?(el: HTMLElement): void
  leave?(el: HTMLElement, done: Function): void
  afterLeave?(el: HTMLElement): void
  leaveCancelled?(el: HTMLElement): void
}

export interface ErrorParams {
  statusCode?: number
  message?: string
}

export interface NuxtLoading extends Vue {
  fail?(): NuxtLoading
  finish(): NuxtLoading
  increase?(num: number): NuxtLoading
  pause?(): NuxtLoading
  start(): NuxtLoading
}

export interface NuxtAppOptions extends ComponentOptions<Vue> {
  [key: string]: any // TBD
}

export interface NuxtApp extends Vue {
  $options: NuxtAppOptions
  $loading: NuxtLoading
  isOffline: boolean
  isOnline: boolean
}
