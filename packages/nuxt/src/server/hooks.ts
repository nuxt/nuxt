import { HookableCore } from 'hookable'
import type { NuxtServerHooks, RequestEvent } from 'nuxt/schema'

import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '../app/types'

/**
 * The return type of a server hook handler.
 *
 * @since 4.6.0
 */
export type ServerHookResult = void | Promise<void>

/**
 * The hooks the Nuxt renderer calls.
 *
 * @since 4.6.0
 */
export interface NuxtServerRendererHooks {
  'render:route': (context: NuxtRenderRouteContext, extra: { event: RequestEvent }) => ServerHookResult
  'render:html': (context: NuxtRenderHTMLContext, extra: { event: RequestEvent, streaming?: boolean }) => ServerHookResult
  'render:html:chunk': (context: NuxtRenderChunkContext, extra: { event: RequestEvent }) => ServerHookResult
  'render:html:close': (context: NuxtRenderCloseContext, extra: { event: RequestEvent }) => ServerHookResult
  'render:island': (response: NuxtIslandResponse, extra: { event: RequestEvent, islandContext: NuxtIslandContext }) => ServerHookResult
}

type HookMap<Hooks> = { [Name in keyof Hooks]: (...args: any[]) => ServerHookResult }

/**
 * Server hooks. Handlers run serially, in registration order.
 *
 * @since 4.6.0
 */
export interface ServerHookable<Hooks extends HookMap<Hooks>> {
  /** Returns a function that removes the handler. */
  hook<Name extends keyof Hooks & string>(name: Name, handler: Hooks[Name]): () => void
  removeHook<Name extends keyof Hooks & string>(name: Name, handler: Hooks[Name]): void
  callHook<Name extends keyof Hooks & string>(name: Name, ...args: Parameters<Hooks[Name]>): Promise<void> | void
}

/**
 * What a renderer plugin is called with.
 *
 * @since 5.0.0
 */
export interface RendererPluginContext {
  /** The hooks of the renderer the plugin is called for. */
  hooks: Pick<ServerHookable<NuxtServerRendererHooks>, 'hook'>
}

/**
 * A renderer plugin, as registered with `addRendererPlugin()`: called once for each
 * renderer, before it renders.
 *
 * @example
 * ```ts
 * import type { RendererPlugin } from 'nuxt/server'
 *
 * export default (({ hooks }) => {
 *   hooks.hook('render:html', (html) => {
 *     html.head.push('<meta name="my-module">')
 *   })
 * }) satisfies RendererPlugin
 * ```
 *
 * @since 5.0.0
 */
export type RendererPlugin = (context: RendererPluginContext) => void

type ServerHooks = ServerHookable<NuxtServerHooks & NuxtServerRendererHooks>

let current: { hooks: ServerHooks, claimed: boolean } | undefined

/**
 * The server runtime hooks: renderer hooks and those declared on {@link NuxtServerHooks}.
 *
 * @example
 * ```ts
 * // server/plugins/robots.ts
 * useServerHooks().hook('render:html', (html, { event }) => {
 *   html.head.push('<meta name="robots" content="noindex">')
 * })
 * ```
 *
 * @since 4.6.0
 */
export function useServerHooks (): ServerHooks {
  current ||= { hooks: new HookableCore() as ServerHooks, claimed: false }
  return current.hooks
}

/**
 * The server hooks for a renderer being created. The first renderer keeps those registered
 * before it; a later one, as a dev server creates when it evaluates the server bundle
 * again, starts with none, so nothing registered for the renderer it replaces runs twice.
 *
 * @internal
 */
export function claimServerHooks (): ServerHooks {
  if (current?.claimed) {
    current = undefined
  }
  const hooks = useServerHooks()
  current!.claimed = true
  return hooks
}
