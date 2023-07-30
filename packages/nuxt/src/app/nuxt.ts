/* eslint-disable no-use-before-define */
import { getCurrentInstance, hasInjectionContext, reactive } from 'vue'
import type { App, Ref, VNode, onErrorCaptured } from 'vue'
import type { RouteLocationNormalizedLoaded } from '#vue-router'
import type { HookCallback, Hookable } from 'hookable'
import { createHooks } from 'hookable'
import { getContext } from 'unctx'
import type { SSRContext, createRenderer } from 'vue-bundle-renderer/runtime'
import type { H3Event } from 'h3'
import type { AppConfig, AppConfigInput, RuntimeConfig } from 'nuxt/schema'
import type { RenderResponse } from 'nitropack'

import type { MergeHead, VueHeadClient } from '@unhead/vue'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandContext } from '../core/runtime/nitro/renderer'
import type { RouteMiddleware } from '../../app'
import type { NuxtError } from '../app/composables/error'
import type { AsyncDataRequestStatus } from '../app/composables/asyncData'

const nuxtAppCtx = /* #__PURE__ */ getContext<NuxtApp>('nuxt-app')

type HookResult = Promise<void> | void

type AppRenderedContext = { ssrContext: NuxtApp['ssrContext'], renderResult: null | Awaited<ReturnType<ReturnType<typeof createRenderer>['renderToString']>> }
export interface RuntimeNuxtHooks {
  'app:created': (app: App<Element>) => HookResult
  'app:beforeMount': (app: App<Element>) => HookResult
  'app:mounted': (app: App<Element>) => HookResult
  'app:rendered': (ctx: AppRenderedContext) => HookResult
  'app:redirected': () => HookResult
  'app:suspense:resolve': (Component?: VNode) => HookResult
  'app:error': (err: any) => HookResult
  'app:error:cleared': (options: { redirect?: string }) => HookResult
  'app:chunkError': (options: { error: any }) => HookResult
  'app:data:refresh': (keys?: string[]) => HookResult
  'link:prefetch': (link: string) => HookResult
  'page:start': (Component?: VNode) => HookResult
  'page:finish': (Component?: VNode) => HookResult
  'page:transition:start': () => HookResult
  'page:transition:finish': (Component?: VNode) => HookResult
  'vue:setup': () => void
  'vue:error': (...args: Parameters<Parameters<typeof onErrorCaptured>[0]>) => HookResult
}

export interface NuxtSSRContext extends SSRContext {
  url: string
  event: H3Event
  runtimeConfig: RuntimeConfig
  noSSR: boolean
  /** whether we are rendering an SSR error */
  error?: boolean
  nuxt: _NuxtApp
  payload: NuxtPayload
  head: VueHeadClient<MergeHead>
  /** This is used solely to render runtime config with SPA renderer. */
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  teleports?: Record<string, string>
  islandContext?: NuxtIslandContext
  /** @internal */
  _renderResponse?: Partial<RenderResponse>
  /** @internal */
  _payloadReducers: Record<string, (data: any) => any>
}

export interface NuxtPayload {
  path?: string
  serverRendered?: boolean
  prerenderedAt?: number
  data: Record<string, any>
  state: Record<string, any>
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  error?: Error | {
    url: string
    statusCode: number
    statusMessage: string
    message: string
    description: string
    data?: any
  } | null
  _errors: Record<string, NuxtError | undefined>
  [key: string]: unknown
}

interface _NuxtApp {
  vueApp: App<Element>
  globalName: string
  versions: Record<string, string>

  hooks: Hookable<RuntimeNuxtHooks>
  hook: _NuxtApp['hooks']['hook']
  callHook: _NuxtApp['hooks']['callHook']

  runWithContext: <T extends () => any>(fn: T) => ReturnType<T> | Promise<Awaited<ReturnType<T>>>

  [key: string]: unknown

  /** @internal */
  _asyncDataPromises: Record<string, Promise<any> | undefined>
  /** @internal */
  _asyncData: Record<string, {
    data: Ref<any>
    pending: Ref<boolean>
    error: Ref<any>
    status: Ref<AsyncDataRequestStatus>
  } | undefined>

  /** @internal */
  _middleware: {
    global: RouteMiddleware[]
    named: Record<string, RouteMiddleware>
  }

  /** @internal */
  _observer?: { observe: (element: Element, callback: () => void) => () => void }
  /** @internal */
  _payloadCache?: Record<string, Promise<Record<string, any>> | Record<string, any>>

  /** @internal */
  _appConfig: AppConfig
  /** @internal */
  _route: RouteLocationNormalizedLoaded

  /** @internal */
  _islandPromises?: Record<string, Promise<any>>

  /** @internal */
  _payloadRevivers: Record<string, (data: any) => any>

  // Nuxt injections
  $config: RuntimeConfig

  isHydrating?: boolean
  deferHydration: () => () => void | Promise<void>

  ssrContext?: NuxtSSRContext
  payload: NuxtPayload
  static: {
    data: Record<string, any>
  }

  provide: (name: string, value: any) => void
}

export interface NuxtApp extends _NuxtApp {}

export const NuxtPluginIndicator = '__nuxt_plugin'

export interface PluginMeta {
  name?: string
  enforce?: 'pre' | 'default' | 'post'
  /**
   * This allows more granular control over plugin order and should only be used by advanced users.
   * It overrides the value of `enforce` and is used to sort plugins.
   */
  order?: number
}

export interface PluginEnvContext {
  /**
   * This enable the plugin for islands components.
   * Require `experimental.componentsIslands`.
   *
   * @default true
   */
  islands?: boolean
}

export interface ResolvedPluginMeta {
  name?: string
  parallel?: boolean
}

export interface Plugin<Injections extends Record<string, unknown> = Record<string, unknown>> {
  (nuxt: _NuxtApp): Promise<void> | Promise<{ provide?: Injections }> | void | { provide?: Injections }
  [NuxtPluginIndicator]?: true
  meta?: ResolvedPluginMeta
}

export interface ObjectPlugin<Injections extends Record<string, unknown> = Record<string, unknown>> extends PluginMeta {
  hooks?: Partial<RuntimeNuxtHooks>
  setup?: Plugin<Injections>
  env?: PluginEnvContext
  /**
   * Execute plugin in parallel with other parallel plugins.
   *
   * @default false
   */
  parallel?: boolean
}

/** @deprecated Use `ObjectPlugin` */
export type ObjectPluginInput<Injections extends Record<string, unknown> = Record<string, unknown>> = ObjectPlugin<Injections>

export interface CreateOptions {
  vueApp: NuxtApp['vueApp']
  ssrContext?: NuxtApp['ssrContext']
  globalName?: NuxtApp['globalName']
}

export function createNuxtApp (options: CreateOptions) {
  let hydratingCount = 0
  const nuxtApp: NuxtApp = {
    provide: undefined,
    globalName: 'nuxt',
    versions: {
      get nuxt () { return __NUXT_VERSION__ },
      get vue () { return nuxtApp.vueApp.version }
    },
    payload: reactive({
      data: {},
      state: {},
      _errors: {},
      ...(process.client ? window.__NUXT__ ?? {} : { serverRendered: true })
    }),
    static: {
      data: {}
    },
    runWithContext: (fn: any) => callWithNuxt(nuxtApp, fn),
    isHydrating: process.client,
    deferHydration () {
      if (!nuxtApp.isHydrating) { return () => {} }

      hydratingCount++
      let called = false

      return () => {
        if (called) { return }

        called = true
        hydratingCount--

        if (hydratingCount === 0) {
          nuxtApp.isHydrating = false
          return nuxtApp.callHook('app:suspense:resolve')
        }
      }
    },
    _asyncDataPromises: {},
    _asyncData: {},
    _payloadRevivers: {},
    ...options
  } as any as NuxtApp

  nuxtApp.hooks = createHooks<RuntimeNuxtHooks>()
  nuxtApp.hook = nuxtApp.hooks.hook

  if (process.server) {
    async function contextCaller (hooks: HookCallback[], args: any[]) {
      for (const hook of hooks) {
        await nuxtApp.runWithContext(() => hook(...args))
      }
    }
    // Patch callHook to preserve NuxtApp context on server
    // TODO: Refactor after https://github.com/unjs/hookable/issues/74
    nuxtApp.hooks.callHook = (name: any, ...args: any[]) => nuxtApp.hooks.callHookWith(contextCaller, name, ...args)
  }

  nuxtApp.callHook = nuxtApp.hooks.callHook

  nuxtApp.provide = (name: string, value: any) => {
    const $name = '$' + name
    defineGetter(nuxtApp, $name, value)
    defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value)
  }

  // Inject $nuxt
  defineGetter(nuxtApp.vueApp, '$nuxt', nuxtApp)
  defineGetter(nuxtApp.vueApp.config.globalProperties, '$nuxt', nuxtApp)

  if (process.server) {
    if (nuxtApp.ssrContext) {
      // Expose nuxt to the renderContext
      nuxtApp.ssrContext.nuxt = nuxtApp
      // Expose payload types
      nuxtApp.ssrContext._payloadReducers = {}
      // Expose current path
      nuxtApp.payload.path = nuxtApp.ssrContext.url
    }
    // Expose to server renderer to create payload
    nuxtApp.ssrContext = nuxtApp.ssrContext || {} as any
    if (nuxtApp.ssrContext!.payload) {
      Object.assign(nuxtApp.payload, nuxtApp.ssrContext!.payload)
    }
    nuxtApp.ssrContext!.payload = nuxtApp.payload

    // Expose client runtime-config to the payload
    nuxtApp.ssrContext!.config = {
      public: options.ssrContext!.runtimeConfig.public,
      app: options.ssrContext!.runtimeConfig.app
    }
  }

  // Listen to chunk load errors
  if (process.client) {
    window.addEventListener('nuxt.preloadError', (event) => {
      nuxtApp.callHook('app:chunkError', { error: (event as Event & { payload: Error }).payload })
    })

    window.useNuxtApp = window.useNuxtApp || useNuxtApp

    // Log errors captured when running plugins, in the `app:created` and `app:beforeMount` hooks
    // as well as when mounting the app.
    const unreg = nuxtApp.hook('app:error', (...args) => { console.error('[nuxt] error caught during app initialization', ...args) })
    nuxtApp.hook('app:mounted', unreg)
  }

  // Expose runtime config
  const runtimeConfig = process.server ? options.ssrContext!.runtimeConfig : reactive(nuxtApp.payload.config!)
  nuxtApp.provide('config', runtimeConfig)

  return nuxtApp
}

export async function applyPlugin (nuxtApp: NuxtApp, plugin: Plugin & ObjectPlugin<any>) {
  if (plugin.hooks) {
    nuxtApp.hooks.addHooks(plugin.hooks)
  }
  if (typeof plugin === 'function') {
    const { provide } = await nuxtApp.runWithContext(() => plugin(nuxtApp)) || {}
    if (provide && typeof provide === 'object') {
      for (const key in provide) {
        nuxtApp.provide(key, provide[key])
      }
    }
  }
}

export async function applyPlugins (nuxtApp: NuxtApp, plugins: Array<Plugin & ObjectPlugin<any>>) {
  const parallels: Promise<any>[] = []
  const errors: Error[] = []
  for (const plugin of plugins) {
    if (process.server && nuxtApp.ssrContext?.islandContext && plugin.env?.islands === false) { continue }
    const promise = applyPlugin(nuxtApp, plugin)
    if (plugin.parallel) {
      parallels.push(promise.catch(e => errors.push(e)))
    } else {
      await promise
    }
  }
  await Promise.all(parallels)
  if (errors.length) { throw errors[0] }
}

/*! @__NO_SIDE_EFFECTS__ */
export function defineNuxtPlugin<T extends Record<string, unknown>> (plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T> {
  if (typeof plugin === 'function') { return plugin }
  delete plugin.name
  return Object.assign(plugin.setup || (() => {}), plugin, { [NuxtPluginIndicator]: true } as const)
}

/*! @__NO_SIDE_EFFECTS__ */
export const definePayloadPlugin = defineNuxtPlugin

export function isNuxtPlugin (plugin: unknown) {
  return typeof plugin === 'function' && NuxtPluginIndicator in plugin
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 *
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export function callWithNuxt<T extends (...args: any[]) => any> (nuxt: NuxtApp | _NuxtApp, setup: T, args?: Parameters<T>) {
  const fn: () => ReturnType<T> = () => args ? setup(...args as Parameters<T>) : setup()
  if (process.server) {
    return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt as NuxtApp, fn))
  } else {
    // In client side we could assume nuxt app is singleton
    nuxtAppCtx.set(nuxt as NuxtApp)
    return nuxt.vueApp.runWithContext(fn)
  }
}

/*! @__NO_SIDE_EFFECTS__ */
/**
 * Returns the current Nuxt instance.
 */
export function useNuxtApp (): NuxtApp {
  let nuxtAppInstance
  if (hasInjectionContext()) {
    nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt
  }

  nuxtAppInstance = nuxtAppInstance || nuxtAppCtx.tryUse()

  if (!nuxtAppInstance) {
    if (process.dev) {
      throw new Error('[nuxt] A composable that requires access to the Nuxt instance was called outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function. This is probably not a Nuxt bug. Find out more at `https://nuxt.com/docs/guide/concepts/auto-imports#using-vue-and-nuxt-composables`.')
    } else {
      throw new Error('[nuxt] instance unavailable')
    }
  }

  return nuxtAppInstance
}

/*! @__NO_SIDE_EFFECTS__ */
export function useRuntimeConfig (): RuntimeConfig {
  return useNuxtApp().$config
}

function defineGetter<K extends string | number | symbol, V> (obj: Record<K, V>, key: K, val: V) {
  Object.defineProperty(obj, key, { get: () => val })
}

export function defineAppConfig<C extends AppConfigInput> (config: C): C {
  return config
}
