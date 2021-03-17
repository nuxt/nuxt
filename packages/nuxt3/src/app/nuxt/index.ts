import Hookable from 'hookable'
import type { App } from 'vue'
import { defineGetter } from '../utils'
import { callWithNuxt } from './composables'

export interface Nuxt {
  app: App
  globalName: string

  hooks: Hookable
  hook: Hookable['hook']
  callHook: Hookable['callHook']

  [key: string]: any

  ssrContext?: Record<string, any>
  payload: {
    serverRendered?: true
    data?: Record<string, any>
    rendered?: Function
    [key: string]: any
  }

  provide: (name: string, value: any) => void
}

export interface Plugin {
  (nuxt: Nuxt, provide?: Nuxt['provide']): Promise<void> | void
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
      serverRendered: true // TODO: legacy
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
