/* eslint-disable no-use-before-define */
import { getCurrentInstance, reactive } from 'vue'
import type { App, VNode } from 'vue'
import { createHooks, Hookable } from 'hookable'
import type { RuntimeConfig } from '@nuxt/schema'
import { legacyPlugin, LegacyContext } from './compat/legacy-app'

type NuxtMeta = {
  htmlAttrs?: string
  headAttrs?: string
  bodyAttrs?: string
  headTags?: string
  bodyPrepend?: string
  bodyScripts?: string
}

type HookResult = Promise<void> | void
export interface RuntimeNuxtHooks {
  'app:created': (app: App<Element>) => HookResult
  'app:beforeMount': (app: App<Element>) => HookResult
  'app:mounted': (app: App<Element>) => HookResult
  'app:rendered': () => HookResult
  'page:start': (Component?: VNode) => HookResult
  'page:finish': (Component?: VNode) => HookResult
  'meta:register': (metaRenderers: Array<(nuxt: NuxtApp) => NuxtMeta | Promise<NuxtMeta>>) => HookResult
}

interface _NuxtApp {
  vueApp: App<Element>
  globalName: string

  hooks: Hookable<RuntimeNuxtHooks>
  hook: _NuxtApp['hooks']['hook']
  callHook: _NuxtApp['hooks']['callHook']

  [key: string]: any

  _asyncDataPromises?: Record<string, Promise<any>>
  _legacyContext?: LegacyContext

  ssrContext?: Record<string, any> & {
    renderMeta?: () => Promise<NuxtMeta> | NuxtMeta
  }
  payload: {
    serverRendered?: true
    data?: Record<string, any>
    state?: Record<string, any>
    rendered?: Function
    [key: string]: any
  }

  provide: (name: string, value: any) => void
}

export interface NuxtApp extends _NuxtApp { }

export const NuxtPluginIndicator = '__nuxt_plugin'
export interface Plugin<Injections extends Record<string, any> = Record<string, any>> {
  (nuxt: _NuxtApp): Promise<void> | Promise<{ provide?: Injections }> | void | { provide?: Injections }
  [NuxtPluginIndicator]?: true
}
export interface LegacyPlugin {
  (context: LegacyContext, provide: NuxtApp['provide']): Promise<void> | void
}

export interface CreateOptions {
  vueApp: NuxtApp['vueApp']
  ssrContext?: NuxtApp['ssrContext']
  globalName?: NuxtApp['globalName']
}

export function createNuxtApp (options: CreateOptions) {
  const nuxtApp: NuxtApp = {
    provide: undefined,
    globalName: 'nuxt',
    payload: reactive({
      data: {},
      state: {},
      _errors: {},
      ...(process.client ? window.__NUXT__ : { serverRendered: true })
    }),
    isHydrating: process.client,
    _asyncDataPromises: {},
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
  defineGetter(nuxtApp.vueApp.config.globalProperties, '$nuxt', nuxtApp)

  // Expose nuxt to the renderContext
  if (nuxtApp.ssrContext) {
    nuxtApp.ssrContext.nuxt = nuxtApp
  }

  if (process.server) {
    // Expose to server renderer to create window.__NUXT__
    nuxtApp.ssrContext = nuxtApp.ssrContext || {}
    nuxtApp.ssrContext.payload = nuxtApp.payload
  }

  // Expose runtime config
  if (process.server) {
    nuxtApp.provide('config', options.ssrContext.runtimeConfig.private)
    nuxtApp.payload.config = options.ssrContext.runtimeConfig.public
  } else {
    nuxtApp.provide('config', reactive(nuxtApp.payload.config))
  }

  return nuxtApp
}

export async function applyPlugin (nuxtApp: NuxtApp, plugin: Plugin) {
  if (typeof plugin !== 'function') { return }
  const { provide } = await callWithNuxt(nuxtApp, () => plugin(nuxtApp)) || {}
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

export function normalizePlugins (_plugins: Array<Plugin | LegacyPlugin>) {
  let needsLegacyContext = false

  const plugins = _plugins.map((plugin) => {
    if (typeof plugin !== 'function') {
      return () => {}
    }
    if (isLegacyPlugin(plugin)) {
      needsLegacyContext = true
      return (nuxtApp: NuxtApp) => plugin(nuxtApp._legacyContext!, nuxtApp.provide)
    }
    return plugin
  })

  if (needsLegacyContext) {
    plugins.unshift(legacyPlugin)
  }

  return plugins as Plugin[]
}

export function defineNuxtPlugin<T> (plugin: Plugin<T>) {
  plugin[NuxtPluginIndicator] = true
  return plugin
}

export function isLegacyPlugin (plugin: unknown): plugin is LegacyPlugin {
  return !plugin[NuxtPluginIndicator]
}

let currentNuxtAppInstance: NuxtApp | null

export const setNuxtAppInstance = (nuxt: NuxtApp | null) => {
  currentNuxtAppInstance = nuxt
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 *
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export function callWithNuxt<T extends () => any> (nuxt: NuxtApp, setup: T) {
  setNuxtAppInstance(nuxt)
  const p: ReturnType<T> = setup()
  if (process.server) {
    // Unset nuxt instance to prevent context-sharing in server-side
    setNuxtAppInstance(null)
  }
  return p
}

/**
 * Returns the current Nuxt instance.
 */
export function useNuxtApp (): NuxtApp {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtAppInstance) {
      throw new Error('nuxt instance unavailable')
    }
    return currentNuxtAppInstance
  }

  return vm.appContext.app.$nuxt
}

export function useRuntimeConfig (): RuntimeConfig {
  return useNuxtApp().$config
}

function defineGetter<K extends string | number | symbol, V> (obj: Record<K, V>, key: K, val: V) {
  Object.defineProperty(obj, key, { get: () => val })
}
