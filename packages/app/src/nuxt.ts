import { getCurrentInstance } from 'vue'
import type { App } from 'vue'
import Hookable from 'hookable'
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

export interface Nuxt {
  app: App
  globalName: string

  hooks: Hookable
  hook: Hookable['hook']
  callHook: Hookable['callHook']

  [key: string]: any

  _asyncDataPromises?: Record<string, Promise<any>>
  _legacyContext?: LegacyContext

  ssrContext?: Record<string, any> & {
    renderMeta?: () => Promise<NuxtMeta> | NuxtMeta
  }
  payload: {
    serverRendered?: true
    data?: Record<string, any>
    rendered?: Function
    [key: string]: any
  }

  provide: (name: string, value: any) => void
}

export const NuxtPluginIndicator = '__nuxt_plugin'
export interface Plugin {
  (nuxt: Nuxt): Promise<void> | void
  [NuxtPluginIndicator]?: true
}
export interface LegacyPlugin {
  (context: LegacyContext, provide: Nuxt['provide']): Promise<void> | void
}

export interface CreateOptions {
  app: Nuxt['app']
  ssrContext?: Nuxt['ssrContext']
  globalName?: Nuxt['globalName']
}

export function createNuxt (options: CreateOptions) {
  const nuxt: Nuxt = {
    provide: undefined,
    globalName: 'nuxt',
    state: {},
    payload: {},
    isHydrating: process.client,
    ...options
  } as any as Nuxt

  nuxt.hooks = new Hookable()
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
    nuxt.payload = {
      serverRendered: true
    }

    nuxt.ssrContext = nuxt.ssrContext || {}

    // Expose to server renderer to create window.__NUXT__
    nuxt.ssrContext.payload = nuxt.payload
  }

  if (process.client) {
    nuxt.payload = window.__NUXT__ || {}
  }

  return nuxt
}

export function applyPlugin (nuxt: Nuxt, plugin: Plugin) {
  if (typeof plugin !== 'function') { return }
  return callWithNuxt(nuxt, () => plugin(nuxt))
}

export async function applyPlugins (nuxt: Nuxt, plugins: Plugin[]) {
  for (const plugin of plugins) {
    await applyPlugin(nuxt, plugin)
  }
}

export function normalizePlugins (_plugins: Array<Plugin | LegacyPlugin>) {
  let needsLegacyContext = false

  const plugins = _plugins.map((plugin) => {
    if (isLegacyPlugin(plugin)) {
      needsLegacyContext = true
      return (nuxt: Nuxt) => plugin(nuxt._legacyContext!, nuxt.provide)
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

let currentNuxtInstance: Nuxt | null

export const setNuxtInstance = (nuxt: Nuxt | null) => {
  currentNuxtInstance = nuxt
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 *
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export async function callWithNuxt (nuxt: Nuxt, setup: () => any) {
  setNuxtInstance(nuxt)
  const p = setup()
  setNuxtInstance(null)
  await p
}

/**
 * Returns the current Nuxt instance.
 */
export function useNuxt (): Nuxt {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtInstance) {
      throw new Error('nuxt instance unavailable')
    }
    return currentNuxtInstance
  }

  return vm.appContext.app.$nuxt
}
