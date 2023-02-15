/* eslint-disable no-use-before-define */
import { getCurrentInstance, reactive } from 'vue'
import type { App, onErrorCaptured, VNode, Ref } from 'vue'
import type { Hookable } from 'hookable'
import { createHooks } from 'hookable'
import { getContext } from 'unctx'
import type { SSRContext } from 'vue-bundle-renderer/runtime'
import type { H3Event } from 'h3'
// eslint-disable-next-line import/no-restricted-paths
import type { NuxtIslandContext } from '../core/runtime/nitro/renderer'
import type { RuntimeConfig, AppConfigInput } from 'nuxt/schema'

const nuxtAppCtx = getContext<NuxtApp>('nuxt-app')

type NuxtMeta = {
  htmlAttrs?: string
  headAttrs?: string
  bodyAttrs?: string
  headTags?: string
  bodyScriptsPrepend?: string
  bodyScripts?: string
}

type HookResult = Promise<void> | void

type AppRenderedContext = { ssrContext: NuxtApp['ssrContext'] }
export interface RuntimeNuxtHooks {
  'app:created': (app: App<Element>) => HookResult
  'app:beforeMount': (app: App<Element>) => HookResult
  'app:mounted': (app: App<Element>) => HookResult
  'app:rendered': (ctx: AppRenderedContext) => HookResult
  'app:redirected': () => HookResult
  'app:suspense:resolve': (Component?: VNode) => HookResult
  'app:error': (err: any) => HookResult
  'app:error:cleared': (options: { redirect?: string }) => HookResult
  'app:data:refresh': (keys?: string[]) => HookResult
  'link:prefetch': (link: string) => HookResult
  'page:start': (Component?: VNode) => HookResult
  'page:finish': (Component?: VNode) => HookResult
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
  payload: _NuxtApp['payload']
  teleports?: Record<string, string>
  renderMeta?: () => Promise<NuxtMeta> | NuxtMeta
  islandContext?: NuxtIslandContext
}

interface _NuxtApp {
  vueApp: App<Element>
  globalName: string

  hooks: Hookable<RuntimeNuxtHooks>
  hook: _NuxtApp['hooks']['hook']
  callHook: _NuxtApp['hooks']['callHook']

  [key: string]: any

  _asyncDataPromises: Record<string, Promise<any> | undefined>
  _asyncData: Record<string, {
    data: Ref<any>
    pending: Ref<boolean>
    error: Ref<any>
  } | undefined>

  isHydrating?: boolean
  deferHydration: () => () => void | Promise<void>

  ssrContext?: NuxtSSRContext
  payload: {
    serverRendered?: boolean
    prerenderedAt?: number
    data: Record<string, any>
    state: Record<string, any>
    rendered?: Function
    error?: Error | {
      url: string
      statusCode: number
      statusMessage: string
      message: string
      description: string
      data?: any
    } | null
    [key: string]: any
  }
  static: {
    data: Record<string, any>
  }

  provide: (name: string, value: any) => void
}

export interface NuxtApp extends _NuxtApp {}

export const NuxtPluginIndicator = '__nuxt_plugin'
export interface Plugin<Injections extends Record<string, any> = Record<string, any>> {
  (nuxt: _NuxtApp): Promise<void> | Promise<{ provide?: Injections }> | void | { provide?: Injections }
  [NuxtPluginIndicator]?: true
}

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
    payload: reactive({
      data: {},
      state: {},
      _errors: {},
      ...(process.client ? window.__NUXT__ : { serverRendered: true })
    }),
    static: {
      data: {}
    },
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
    ...options
  } as any as NuxtApp

  nuxtApp.hooks = createHooks<RuntimeNuxtHooks>()
  nuxtApp.hook = nuxtApp.hooks.hook
  nuxtApp.callHook = nuxtApp.hooks.callHook

  nuxtApp.provide = (name: string, value: any) => {
    const $name = '$' + name
    defineGetter(nuxtApp, $name, value)
    defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value)
  }

  // Inject $nuxt
  defineGetter(nuxtApp.vueApp, '$nuxt', nuxtApp)
  // @ts-expect-error
  defineGetter(nuxtApp.vueApp.config.globalProperties, '$nuxt', nuxtApp)

  if (process.server) {
    // Expose nuxt to the renderContext
    if (nuxtApp.ssrContext) {
      nuxtApp.ssrContext.nuxt = nuxtApp
    }
    // Expose to server renderer to create window.__NUXT__
    nuxtApp.ssrContext = nuxtApp.ssrContext || {} as any
    if (nuxtApp.ssrContext!.payload) {
      Object.assign(nuxtApp.payload, nuxtApp.ssrContext!.payload)
    }
    nuxtApp.ssrContext!.payload = nuxtApp.payload

    // Expose client runtime-config to the payload
    nuxtApp.payload.config = {
      public: options.ssrContext!.runtimeConfig.public,
      app: options.ssrContext!.runtimeConfig.app
    }
  }

  // Expose runtime config
  const runtimeConfig = process.server
    ? options.ssrContext!.runtimeConfig
    : reactive(nuxtApp.payload.config)

  // Backward compatibility following #4254
  const compatibilityConfig = new Proxy(runtimeConfig, {
    get (target, prop) {
      if (prop === 'public') {
        return target.public
      }
      return target[prop] ?? target.public[prop]
    },
    set (target, prop, value) {
      if (process.server || prop === 'public' || prop === 'app') {
        return false // Throws TypeError
      }
      target[prop] = value
      target.public[prop] = value
      return true
    }
  })

  nuxtApp.provide('config', compatibilityConfig)

  return nuxtApp
}

export async function applyPlugin (nuxtApp: NuxtApp, plugin: Plugin) {
  if (typeof plugin !== 'function') { return }
  const { provide } = await callWithNuxt(nuxtApp, plugin, [nuxtApp]) || {}
  if (provide && typeof provide === 'object') {
    for (const key in provide) {
      nuxtApp.provide(key, provide[key])
    }
  }
}

export async function applyPlugins (nuxtApp: NuxtApp, plugins: Plugin[]) {
  for (const plugin of plugins) {
    await applyPlugin(nuxtApp, plugin)
  }
}

export function normalizePlugins (_plugins: Plugin[]) {
  const unwrappedPlugins: Plugin[] = []
  const legacyInjectPlugins: Plugin[] = []
  const invalidPlugins: Plugin[] = []

  const plugins = _plugins.map((plugin) => {
    if (typeof plugin !== 'function') {
      invalidPlugins.push(plugin)
      return null
    }
    if (plugin.length > 1) {
      legacyInjectPlugins.push(plugin)
      // Allow usage without wrapper but warn
      // TODO: Skip invalid in next releases
      // @ts-ignore
      return (nuxtApp: NuxtApp) => plugin(nuxtApp, nuxtApp.provide)
      // return null
    }
    if (!isNuxtPlugin(plugin)) {
      unwrappedPlugins.push(plugin)
      // Allow usage without wrapper but warn
    }
    return plugin
  }).filter(Boolean)

  if (process.dev && legacyInjectPlugins.length) {
    console.warn('[warn] [nuxt] You are using a plugin with legacy Nuxt 2 format (context, inject) which is likely to be broken. In the future they will be ignored:', legacyInjectPlugins.map(p => p.name || p).join(','))
  }
  if (process.dev && invalidPlugins.length) {
    console.warn('[warn] [nuxt] Some plugins are not exposing a function and skipped:', invalidPlugins)
  }
  if (process.dev && unwrappedPlugins.length) {
    console.warn('[warn] [nuxt] You are using a plugin that has not been wrapped in `defineNuxtPlugin`. It is advised to wrap your plugins as in the future this may enable enhancements:', unwrappedPlugins.map(p => p.name || p).join(','))
  }

  return plugins as Plugin[]
}

export function defineNuxtPlugin<T extends Record<string, any>> (plugin: Plugin<T>) {
  plugin[NuxtPluginIndicator] = true
  return plugin
}

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
    return nuxtAppCtx.callAsync(nuxt, fn)
  } else {
    // In client side we could assume nuxt app is singleton
    nuxtAppCtx.set(nuxt)
    return fn()
  }
}

/**
 * Returns the current Nuxt instance.
 */
export function useNuxtApp () {
  const nuxtAppInstance = nuxtAppCtx.tryUse()

  if (!nuxtAppInstance) {
    const vm = getCurrentInstance()
    if (!vm) {
      throw new Error('nuxt instance unavailable')
    }
    return vm.appContext.app.$nuxt as NuxtApp
  }

  return nuxtAppInstance
}

export function useRuntimeConfig (): RuntimeConfig {
  return useNuxtApp().$config
}

function defineGetter<K extends string | number | symbol, V> (obj: Record<K, V>, key: K, val: V) {
  Object.defineProperty(obj, key, { get: () => val })
}

export function defineAppConfig<C extends AppConfigInput> (config: C): C {
  return config
}
