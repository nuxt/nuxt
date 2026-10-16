import { createHooks } from 'hookable'
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

let hooks: ServerHookable<NuxtServerHooks & NuxtServerRendererHooks> | undefined

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
export function useServerHooks (): ServerHookable<NuxtServerHooks & NuxtServerRendererHooks> {
  return hooks ||= createHooks() as unknown as ServerHookable<NuxtServerHooks & NuxtServerRendererHooks>
}
