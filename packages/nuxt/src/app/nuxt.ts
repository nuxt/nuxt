import { effectScope, getCurrentInstance, getCurrentScope, hasInjectionContext, reactive, shallowReactive } from 'vue'
import type { App, EffectScope, Ref, VNode, onErrorCaptured } from 'vue'
import type { RouteLocationNormalizedLoaded } from '#vue-router'
import type { HookCallback, Hookable } from 'hookable'
import { createHooks } from 'hookable'
import { getContext } from 'unctx'
import type { SSRContext, createRenderer } from 'vue-bundle-renderer/runtime'
import type { EventHandlerRequest, H3Event } from 'h3'
import type { AppConfig, AppConfigInput, RuntimeConfig } from 'nuxt/schema'
import type { RenderResponse } from 'nitropack'
import type { LogObject } from 'consola'
import type { MergeHead, VueHeadClient } from '@unhead/vue'

import type { NuxtIslandContext } from '../app/types'
import type { RouteMiddleware } from '../app/composables/router'
import type { NuxtError } from '../app/composables/error'
import type { AsyncDataRequestStatus } from '../app/composables/asyncData'
import type { NuxtAppManifestMeta } from '../app/composables/manifest'
import type { LoadingIndicator } from '../app/composables/loading-indicator'
import type { RouteAnnouncer } from '../app/composables/route-announcer'
import type { ViewTransition } from './plugins/view-transitions.client'

// @ts-expect-error virtual file
import { appId } from '#build/nuxt.config.mjs'

// TODO: temporary module for backwards compatibility
import type { DefaultAsyncDataErrorValue, DefaultErrorValue } from '#app/defaults'
import type { NuxtAppLiterals } from '#app'

function getNuxtAppCtx (appName = appId || 'nuxt-app') {
  return getContext<NuxtApp>(appName, {
    asyncContext: !!__NUXT_ASYNC_CONTEXT__ && import.meta.server,
  })
}

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
  'app:manifest:update': (meta?: NuxtAppManifestMeta) => HookResult
  'dev:ssr-logs': (logs: LogObject[]) => void | Promise<void>
  'link:prefetch': (link: string) => HookResult
  'page:start': (Component?: VNode) => HookResult
  'page:finish': (Component?: VNode) => HookResult
  'page:transition:start': () => HookResult
  'page:transition:finish': (Component?: VNode) => HookResult
  'page:view-transition:start': (transition: ViewTransition) => HookResult
  'page:loading:start': () => HookResult
  'page:loading:end': () => HookResult
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
  payload: Partial<NuxtPayload>
  head: VueHeadClient<MergeHead>
  /** This is used solely to render runtime config with SPA renderer. */
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  teleports?: Record<string, string>
  islandContext?: NuxtIslandContext
  /** @internal */
  _renderResponse?: Partial<RenderResponse>
  /** @internal */
  _payloadReducers: Record<string, (data: any) => any>
  /** @internal */
  _sharedPrerenderCache?: {
    get<T = unknown> (key: string): Promise<T> | undefined
    set<T> (key: string, value: Promise<T>): Promise<void>
  }
}

export interface NuxtPayload {
  path?: string
  serverRendered?: boolean
  prerenderedAt?: number
  data: Record<string, any>
  state: Record<string, any>
  once: Set<string>
  config?: Pick<RuntimeConfig, 'public' | 'app'>
  error?: NuxtError | DefaultErrorValue
  _errors: Record<string, NuxtError | DefaultAsyncDataErrorValue>
  [key: string]: unknown
}

interface _NuxtApp {
  /** @internal */
  _name: string
  vueApp: App<Element>
  globalName: string
  versions: Record<string, string>

  hooks: Hookable<RuntimeNuxtHooks>
  hook: _NuxtApp['hooks']['hook']
  callHook: _NuxtApp['hooks']['callHook']

  runWithContext: <T extends () => any>(fn: T) => ReturnType<T> | Promise<Awaited<ReturnType<T>>>

  [key: string]: unknown

  /** @internal */
  _id?: number
  /** @internal */
  _scope: EffectScope
  /** @internal */
  _asyncDataPromises: Record<string, Promise<any> | undefined>
  /** @internal */
  _asyncData: Record<string, {
    data: Ref<unknown>
    pending: Ref<boolean>
    error: Ref<Error | DefaultAsyncDataErrorValue>
    status: Ref<AsyncDataRequestStatus>
    /** @internal */
    _default: () => unknown
  } | undefined>

  /** @internal */
  _loadingIndicator?: LoadingIndicator
  /** @internal */
  _loadingIndicatorDeps?: number

  /** @internal */
  _middleware: {
    global: RouteMiddleware[]
    named: Record<string, RouteMiddleware>
  }

  /** @internal */
  _once: {
    [key: string]: Promise<any>
  }

  /** @internal */
  _observer?: { observe: (element: Element, callback: () => void) => () => void }
  /** @internal */
  _payloadCache?: Record<string, Promise<Record<string, any>> | Record<string, any> | null>

  /** @internal */
  _appConfig: AppConfig
  /** @internal */
  _route: RouteLocationNormalizedLoaded

  /** @internal */
  _islandPromises?: Record<string, Promise<any>>

  /** @internal */
  _payloadRevivers: Record<string, (data: any) => any>

  /** @internal */
  _routeAnnouncer?: RouteAnnouncer
  /** @internal */
  _routeAnnouncerDeps?: number

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
   * Await for other named plugins to finish before running this plugin.
   */
  dependsOn?: NuxtAppLiterals['pluginName'][]
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
   * @default false
   */
  parallel?: boolean
  /**
   * @internal
   */
  _name?: string
}

/** @deprecated Use `ObjectPlugin` */
export type ObjectPluginInput<Injections extends Record<string, unknown> = Record<string, unknown>> = ObjectPlugin<Injections>

export interface CreateOptions {
  vueApp: NuxtApp['vueApp']
  ssrContext?: NuxtApp['ssrContext']
  globalName?: NuxtApp['globalName']
}

/** @since 3.0.0 */
export function createNuxtApp (options: CreateOptions) {
  let hydratingCount = 0
  const nuxtApp: NuxtApp = {
    _name: appId || 'nuxt-app',
    _scope: effectScope(),
    provide: undefined,
    globalName: 'nuxt',
    versions: {
      get nuxt () { return __NUXT_VERSION__ },
      get vue () { return nuxtApp.vueApp.version },
    },
    payload: shallowReactive({
      data: shallowReactive({}),
      state: reactive({}),
      once: new Set<string>(),
      _errors: shallowReactive({}),
    }),
    static: {
      data: {},
    },
    runWithContext (fn: any) {
      if (nuxtApp._scope.active && !getCurrentScope()) {
        return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn))
      }
      return callWithNuxt(nuxtApp, fn)
    },
    isHydrating: import.meta.client,
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
    _asyncData: shallowReactive({}),
    _payloadRevivers: {},
    ...options,
  } as any as NuxtApp

  if (import.meta.server) {
    nuxtApp.payload.serverRendered = true
  }

  // TODO: remove/refactor in https://github.com/nuxt/nuxt/issues/25336
  if (import.meta.client && window.__NUXT__) {
    for (const key in window.__NUXT__) {
      switch (key) {
        case 'data':
        case 'state':
        case '_errors':
          // Preserve reactivity for non-rich payload support
          Object.assign(nuxtApp.payload[key], window.__NUXT__[key])
          break

        default:
          nuxtApp.payload[key] = window.__NUXT__[key]
      }
    }
  }

  nuxtApp.hooks = createHooks<RuntimeNuxtHooks>()
  nuxtApp.hook = nuxtApp.hooks.hook

  if (import.meta.server) {
    const contextCaller = async function (hooks: HookCallback[], args: any[]) {
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

  if (import.meta.server) {
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
      app: options.ssrContext!.runtimeConfig.app,
    }
  }

  // Listen to chunk load errors
  if (import.meta.client) {
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
  const runtimeConfig = import.meta.server ? options.ssrContext!.runtimeConfig : nuxtApp.payload.config!
  nuxtApp.provide('config', import.meta.client && import.meta.dev ? wrappedConfig(runtimeConfig) : runtimeConfig)

  return nuxtApp
}

/** @since 3.12.0 */
export function registerPluginHooks (nuxtApp: NuxtApp, plugin: Plugin & ObjectPlugin<any>) {
  if (plugin.hooks) {
    nuxtApp.hooks.addHooks(plugin.hooks)
  }
}

/** @since 3.0.0 */
export async function applyPlugin (nuxtApp: NuxtApp, plugin: Plugin & ObjectPlugin<any>) {
  if (typeof plugin === 'function') {
    const { provide } = await nuxtApp.runWithContext(() => plugin(nuxtApp)) || {}
    if (provide && typeof provide === 'object') {
      for (const key in provide) {
        nuxtApp.provide(key, provide[key])
      }
    }
  }
}

/** @since 3.0.0 */
export async function applyPlugins (nuxtApp: NuxtApp, plugins: Array<Plugin & ObjectPlugin<any>>) {
  const resolvedPlugins: string[] = []
  const unresolvedPlugins: [Set<string>, Plugin & ObjectPlugin<any>][] = []
  const parallels: Promise<any>[] = []
  const errors: Error[] = []
  let promiseDepth = 0

  async function executePlugin (plugin: Plugin & ObjectPlugin<any>) {
    const unresolvedPluginsForThisPlugin = plugin.dependsOn?.filter(name => plugins.some(p => p._name === name) && !resolvedPlugins.includes(name)) ?? []
    if (unresolvedPluginsForThisPlugin.length > 0) {
      unresolvedPlugins.push([new Set(unresolvedPluginsForThisPlugin), plugin])
    } else {
      const promise = applyPlugin(nuxtApp, plugin).then(async () => {
        if (plugin._name) {
          resolvedPlugins.push(plugin._name)
          await Promise.all(unresolvedPlugins.map(async ([dependsOn, unexecutedPlugin]) => {
            if (dependsOn.has(plugin._name!)) {
              dependsOn.delete(plugin._name!)
              if (dependsOn.size === 0) {
                promiseDepth++
                await executePlugin(unexecutedPlugin)
              }
            }
          }))
        }
      })

      if (plugin.parallel) {
        parallels.push(promise.catch(e => errors.push(e)))
      } else {
        await promise
      }
    }
  }

  for (const plugin of plugins) {
    if (import.meta.server && nuxtApp.ssrContext?.islandContext && plugin.env?.islands === false) { continue }
    registerPluginHooks(nuxtApp, plugin)
  }

  for (const plugin of plugins) {
    if (import.meta.server && nuxtApp.ssrContext?.islandContext && plugin.env?.islands === false) { continue }
    await executePlugin(plugin)
  }

  await Promise.all(parallels)
  if (promiseDepth) {
    for (let i = 0; i < promiseDepth; i++) {
      await Promise.all(parallels)
    }
  }

  if (errors.length) { throw errors[0] }
}

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export function defineNuxtPlugin<T extends Record<string, unknown>> (plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T> {
  if (typeof plugin === 'function') { return plugin }

  const _name = plugin._name || plugin.name
  delete plugin.name
  return Object.assign(plugin.setup || (() => {}), plugin, { [NuxtPluginIndicator]: true, _name } as const)
}

/* @__NO_SIDE_EFFECTS__ */
export const definePayloadPlugin = defineNuxtPlugin

/** @since 3.0.0 */
export function isNuxtPlugin (plugin: unknown) {
  return typeof plugin === 'function' && NuxtPluginIndicator in plugin
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxtApp`.
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 * @since 3.0.0
 */
export function callWithNuxt<T extends (...args: any[]) => any> (nuxt: NuxtApp | _NuxtApp, setup: T, args?: Parameters<T>) {
  const fn: () => ReturnType<T> = () => args ? setup(...args as Parameters<T>) : setup()
  const nuxtAppCtx = getNuxtAppCtx(nuxt._name)
  if (import.meta.server) {
    return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt as NuxtApp, fn))
  } else {
    // In client side we could assume nuxt app is singleton
    nuxtAppCtx.set(nuxt as NuxtApp)
    return nuxt.vueApp.runWithContext(fn)
  }
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Returns the current Nuxt instance.
 *
 * Returns `null` if Nuxt instance is unavailable.
 * @since 3.10.0
 */
export function tryUseNuxtApp (): NuxtApp | null
export function tryUseNuxtApp (appName?: string): NuxtApp | null {
  let nuxtAppInstance
  if (hasInjectionContext()) {
    nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt
  }

  nuxtAppInstance = nuxtAppInstance || getNuxtAppCtx(appName).tryUse()

  return nuxtAppInstance || null
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Returns the current Nuxt instance.
 *
 * Throws an error if Nuxt instance is unavailable.
 * @since 3.0.0
 */
export function useNuxtApp (): NuxtApp
export function useNuxtApp (appName?: string): NuxtApp {
  // @ts-expect-error internal usage of appName
  const nuxtAppInstance = tryUseNuxtApp(appName)

  if (!nuxtAppInstance) {
    if (import.meta.dev) {
      throw new Error('[nuxt] A composable that requires access to the Nuxt instance was called outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function. This is probably not a Nuxt bug. Find out more at `https://nuxt.com/docs/guide/concepts/auto-imports#vue-and-nuxt-composables`.')
    } else {
      throw new Error('[nuxt] instance unavailable')
    }
  }

  return nuxtAppInstance
}

/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
export function useRuntimeConfig (_event?: H3Event<EventHandlerRequest>): RuntimeConfig {
  return useNuxtApp().$config
}

function defineGetter<K extends string | number | symbol, V> (obj: Record<K, V>, key: K, val: V) {
  Object.defineProperty(obj, key, { get: () => val })
}

/** @since 3.0.0 */
export function defineAppConfig<C extends AppConfigInput> (config: C): C {
  return config
}

/**
 * Configure error getter on runtime secret property access that doesn't exist on the client side
 */
function wrappedConfig (runtimeConfig: Record<string, unknown>) {
  if (!import.meta.dev || import.meta.server) { return runtimeConfig }
  const keys = Object.keys(runtimeConfig).map(key => `\`${key}\``)
  const lastKey = keys.pop()
  return new Proxy(runtimeConfig, {
    get (target, p, receiver) {
      if (typeof p === 'string' && p !== 'public' && !(p in target) && !p.startsWith('__v') /* vue check for reactivity, e.g. `__v_isRef` */) {
        console.warn(`[nuxt] Could not access \`${p}\`. The only available runtime config keys on the client side are ${keys.join(', ')} and ${lastKey}. See \`https://nuxt.com/docs/guide/going-further/runtime-config\` for more information.`)
      }
      return Reflect.get(target, p, receiver)
    },
  })
}
