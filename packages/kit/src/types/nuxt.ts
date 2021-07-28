import { NuxtHookName, NuxtHooks } from './hooks'
import { NuxtOptions } from './config'

export interface Nuxt {
  /** The resolved Nuxt configuration. */
  options: NuxtOptions

  hooks: {
    /** Register a function to be run when the named Nuxt hook is called. */
    hook<Hook extends NuxtHookName>(hookName: Hook, callback: NuxtHooks[Hook]): void | Promise<void>
    /** Run all Nuxt hooks that have been registered against the hook name. */
    callHook<Hook extends NuxtHookName>(hookName: Hook, ...args: Parameters<NuxtHooks[Hook]>): ReturnType<NuxtHooks[Hook]>
    /** Add all hooks in the object passed in. */
    addHooks(hooks: Partial<NuxtHooks>): void
  }
  hook: Nuxt['hooks']['hook']
  callHook: Nuxt['hooks']['callHook']

  ready: () => Promise<void>
  close: () => Promise<void>

  /** The production or development server */
  server?: any

  vfs: Record<string, string>
}

export interface NuxtTemplate {
  /** @deprecated filename */
  fileName?: string
  /** resolved output file path (generated) */
  dst?: string
  /** The target filename once the template is copied into the Nuxt buildDir */
  filename?: string
  /** An options object that will be accessible within the template via `<% options %>` */
  options?: Record<string, any>
  /** The resolved path to the source file to be template */
  src?: string
  /** Provided compile option intead of src */
  getContents?: (data: Record<string, any>) => string | Promise<string>
}

export interface NuxtPlugin {
  /** @deprecated use mode */
  ssr?: boolean
  src: string
  mode?: 'all' | 'server' | 'client'
}

export interface NuxtApp {
  main?: string
  dir: string
  extensions: string[]
  plugins: NuxtPlugin[]
  templates: NuxtTemplate[]
}

type _TemplatePlugin = NuxtPlugin & NuxtTemplate
export interface NuxtPluginTemplate extends _TemplatePlugin {}
