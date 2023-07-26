import type { Hookable } from 'hookable'
import type { Ignore } from 'ignore'
import type { NuxtHooks, NuxtLayout, NuxtMiddleware } from './hooks'
import type { Component } from './components'
import type { NuxtOptions } from './config'

export interface Nuxt {
  // Private fields.
  _version: string
  _ignore?: Ignore

  /** The resolved Nuxt configuration. */
  options: NuxtOptions
  hooks: Hookable<NuxtHooks>
  hook: Nuxt['hooks']['hook']
  callHook: Nuxt['hooks']['callHook']
  addHooks: Nuxt['hooks']['addHooks']

  ready: () => Promise<void>
  close: () => Promise<void>

  /** The production or development server. */
  server?: any

  vfs: Record<string, string>

  apps: Record<string, NuxtApp>
}

export interface NuxtTemplate<Options = Record<string, any>> {
  /** resolved output file path (generated) */
  dst?: string
  /** The target filename once the template is copied into the Nuxt buildDir */
  filename?: string
  /** An options object that will be accessible within the template via `<% options %>` */
  options?: Options
  /** The resolved path to the source file to be template */
  src?: string
  /** Provided compile option instead of src */
  getContents?: (data: Options) => string | Promise<string>
  /** Write to filesystem */
  write?: boolean
}

export interface ResolvedNuxtTemplate<Options = Record<string, any>> extends NuxtTemplate<Options> {
  filename: string
  dst: string
}

export interface NuxtPlugin {
  /** @deprecated use mode */
  ssr?: boolean
  src: string
  mode?: 'all' | 'server' | 'client'
  /**
   * This allows more granular control over plugin order and should only be used by advanced users.
   * Lower numbers run first, and user plugins default to `0`.
   *
   * Default Nuxt priorities can be seen at [here](https://github.com/nuxt/nuxt/blob/9904849bc87c53dfbd3ea3528140a5684c63c8d8/packages/nuxt/src/core/plugins/plugin-metadata.ts#L15-L34).
   */
  order?: number
}

export interface NuxtApp {
  mainComponent?: string | null
  rootComponent?: string | null
  errorComponent?: string | null
  dir: string
  extensions: string[]
  plugins: NuxtPlugin[]
  components: Component[]
  layouts: Record<string, NuxtLayout>
  middleware: NuxtMiddleware[]
  templates: NuxtTemplate[]
  configs: string[]
}

type _TemplatePlugin<Options> = Omit<NuxtPlugin, 'src'> & NuxtTemplate<Options>
export interface NuxtPluginTemplate<Options = Record<string, any>> extends _TemplatePlugin<Options> { }
