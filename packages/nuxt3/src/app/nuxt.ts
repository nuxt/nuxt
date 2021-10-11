/* eslint-disable no-use-before-define */
import { getCurrentInstance, reactive } from 'vue'
import type { App, VNode } from 'vue'
import { createHooks, Hookable } from 'hookable'
import { defineGetter } from './utils'
import { legacyPlugin, LegacyContext } from './legacy'

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

export interface NuxtApp {
  app: App<Element>
  globalName: string

  hooks: Hookable<RuntimeNuxtHooks>
  hook: NuxtApp['hooks']['hook']
  callHook: NuxtApp['hooks']['callHook']

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

export const NuxtPluginIndicator = '__nuxt_plugin'
export interface Plugin {
  (nuxt: NuxtApp): Promise<void> | void
  [NuxtPluginIndicator]?: true
}
export interface LegacyPlugin {
  (context: LegacyContext, provide: NuxtApp['provide']): Promise<void> | void
}

export interface CreateOptions {
  app: NuxtApp['app']
  ssrContext?: NuxtApp['ssrContext']
  globalName?: NuxtApp['globalName']
}

export function createNuxtApp (options: CreateOptions) {
  const nuxt: NuxtApp = {
    provide: undefined,
    globalName: 'nuxt',
    payload: reactive({
      data: {},
      state: {},
      ...(process.client ? window.__NUXT__ : { serverRendered: true })
    }),
    isHydrating: process.client,
    _asyncDataPromises: {},
    ...options
  } as any as NuxtApp

  nuxt.hooks = createHooks<RuntimeNuxtHooks>()
  nuxt.hook = nuxt.hooks.hook
  nuxt.callHook = nuxt.hooks.callHook

  nuxt.provide = (name: string, value: any) => {
    const $name = '$' + name
    defineGetter(nuxt, $name, value)
    defineGetter(nuxt.app.config.globalProperties, $name, value)
  }

  // Inject $nuxt
  defineGetter(nuxt.app, '$nuxt', nuxt)
  defineGetter(nuxt.app.config.globalProperties, '$nuxt', nuxt)

  // Expose nuxt to the renderContext
  if (nuxt.ssrContext) {
    nuxt.ssrContext.nuxt = nuxt
  }

  if (process.server) {
    // Expose to server renderer to create window.__NUXT__
    nuxt.ssrContext = nuxt.ssrContext || {}
    nuxt.ssrContext.payload = nuxt.payload
  }

  // Expose runtime config
  if (process.server) {
    nuxt.provide('config', options.ssrContext.runtimeConfig.private)
    nuxt.payload.config = options.ssrContext.runtimeConfig.public
  } else {
    nuxt.provide('config', reactive(nuxt.payload.config))
  }

  return nuxt
}

export function applyPlugin (nuxt: NuxtApp, plugin: Plugin) {
  if (typeof plugin !== 'function') { return }
  return callWithNuxt(nuxt, () => plugin(nuxt))
}

export async function applyPlugins (nuxt: NuxtApp, plugins: Plugin[]) {
  for (const plugin of plugins) {
    await applyPlugin(nuxt, plugin)
  }
}

export function normalizePlugins (_plugins: Array<Plugin | LegacyPlugin>) {
  let needsLegacyContext = false

  const plugins = _plugins.map((plugin) => {
    if (isLegacyPlugin(plugin)) {
      needsLegacyContext = true
      return (nuxt: NuxtApp) => plugin(nuxt._legacyContext!, nuxt.provide)
    }
    return plugin
  })

  if (needsLegacyContext) {
    plugins.unshift(legacyPlugin)
  }

  return plugins as Plugin[]
}

export function defineNuxtPlugin (plugin: Plugin) {
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
export async function callWithNuxt (nuxt: NuxtApp, setup: () => any) {
  setNuxtAppInstance(nuxt)
  const p = setup()
  setNuxtAppInstance(null)
  await p
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

export function useRuntimeConfig (): Record<string, any> {
  return useNuxtApp().$config
}
