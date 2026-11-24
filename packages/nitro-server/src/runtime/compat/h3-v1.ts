/**
 * h3 v1 helper surface implemented on h3 v2 (`nitro/h3`) primitives. Server code written
 * for h3 v1 resolves `h3` to this module.
 *
 * Absent, because they leak node or plain internals h3 v2 does not model: `H3Headers`,
 * `H3Response`, `createEvent`, `fromPlainHandler`, `toPlainHandler`,
 * `promisifyNodeListener`, `callNodeListener`, `createAppEventHandler`.
 */
import { defineHandler, defineWebSocketHandler } from 'nitro/h3'
import type { EventHandlerRequest, EventHandlerResponse, EventHandlerWithFetch, H3Event, defineWebSocket } from 'nitro/h3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { $Fetch } from 'ofetch'

import { getRouteRules } from '../utils/route-rules.ts'
import { fromLegacyBody, prepareLegacyEvent } from './event.ts'
import { getEndedResponse } from './ended-response.ts'
import { toLegacyError } from './error-shape.ts'

export * from './h3-v1-app.ts'

/**
 * The event a v1 handler receives. `event.node` is always present; `event.fetch` and
 * `event.$fetch` are present on the requests Nitro serves, not on a direct `handler.fetch()` call.
 */
export type LegacyH3Event = H3Event & {
  node: { req: IncomingMessage, res: ServerResponse }
  fetch: typeof globalThis.fetch
  $fetch: $Fetch
}

type LegacyHandlerObject<ResponseT = EventHandlerResponse> = {
  handler: (event: LegacyH3Event) => ResponseT
  onRequest?: ((event: LegacyH3Event) => any) | Array<(event: LegacyH3Event) => any>
  onBeforeResponse?: ((event: LegacyH3Event, response: { body?: any }) => any) | Array<(event: LegacyH3Event, response: { body?: any }) => any>
  websocket?: ReturnType<typeof defineWebSocket>
  [key: string]: any
}

function toArray<T> (input: T | T[] | undefined): T[] {
  return input === undefined ? [] : Array.isArray(input) ? input : [input]
}

/**
 * v1 `defineEventHandler`, including the object form with `onRequest` /
 * `onBeforeResponse` hooks and `websocket` hooks, which h3 v2 no longer accepts. The returned
 * handler prepares the v1 event shape and normalises thrown errors, so it needs no
 * entry-level wrapper. A WebSocket upgrade request gets the `websocket` hooks.
 */
export function defineEventHandler<ResponseT = EventHandlerResponse> (input: ((event: LegacyH3Event) => ResponseT) | LegacyHandlerObject<ResponseT>): EventHandlerWithFetch<EventHandlerRequest, ResponseT> {
  const handler = typeof input === 'function' ? input : input.handler
  const rest: Partial<LegacyHandlerObject<ResponseT>> = typeof input === 'function' ? {} : { ...input }
  delete rest.handler
  const onRequestHooks = toArray(typeof input === 'function' ? undefined : input.onRequest)
  const onBeforeResponseHooks = toArray(typeof input === 'function' ? undefined : input.onBeforeResponse)
  delete rest.onRequest
  delete rest.onBeforeResponse
  const upgrade = typeof input === 'function' || !input.websocket ? undefined : defineWebSocketHandler(input.websocket)
  delete rest.websocket

  return defineHandler({
    ...rest,
    async handler (input: H3Event) {
      if (upgrade && input.req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        return upgrade(input)
      }
      const event = prepareLegacyEvent(input, getRouteRules) as LegacyH3Event
      try {
        if (getEndedResponse(event) !== undefined) {
          return fromLegacyBody(event, undefined)
        }
        for (const hook of onRequestHooks) {
          await hook(event)
          if (getEndedResponse(event) !== undefined) {
            return fromLegacyBody(event, undefined)
          }
        }
        const response = { body: await handler(event) }
        for (const hook of onBeforeResponseHooks) {
          await hook(event, response)
        }
        return fromLegacyBody(event, response.body)
      } catch (error) {
        throw toLegacyError(error)
      }
    },
  }) as EventHandlerWithFetch<EventHandlerRequest, ResponseT>
}

export const eventHandler = defineEventHandler
