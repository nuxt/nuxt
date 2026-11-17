/**
 * h3 v1 helper surface implemented on h3 v2 (`nitro/h3`) primitives. Server code written
 * for h3 v1 resolves `h3` to this module.
 *
 * Absent, because they leak node or plain internals h3 v2 does not model: `H3Headers`,
 * `H3Response`, `createEvent`, `fromPlainHandler`, `toPlainHandler`,
 * `promisifyNodeListener`, `callNodeListener`, `createAppEventHandler`.
 */
import { defineHandler } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { getRouteRules } from '../utils/route-rules.ts'
import { prepareLegacyEvent, withLegacyContentType } from './event.ts'
import { toLegacyError } from './error-shape.ts'

export * from './h3-v1-app.ts'

/** The event a v1 handler receives, on which `event.node` is always present. */
export type LegacyH3Event = H3Event & { node: { req: IncomingMessage, res: ServerResponse } }

type LegacyHandlerObject = {
  handler: (event: LegacyH3Event) => any
  onRequest?: ((event: LegacyH3Event) => any) | Array<(event: LegacyH3Event) => any>
  onBeforeResponse?: ((event: LegacyH3Event, response: { body?: any }) => any) | Array<(event: LegacyH3Event, response: { body?: any }) => any>
  [key: string]: any
}

function toArray<T> (input: T | T[] | undefined): T[] {
  return input === undefined ? [] : Array.isArray(input) ? input : [input]
}

/**
 * v1 `defineEventHandler`, including the object form with `onRequest` /
 * `onBeforeResponse` hooks, which h3 v2 no longer accepts. The returned handler prepares
 * the v1 event shape and normalises thrown errors, so it needs no entry-level wrapper.
 */
export function defineEventHandler (input: ((event: LegacyH3Event) => any) | LegacyHandlerObject): any {
  const handler = typeof input === 'function' ? input : input.handler
  const rest: Partial<LegacyHandlerObject> = typeof input === 'function' ? {} : { ...input }
  delete rest.handler
  const onRequestHooks = toArray(typeof input === 'function' ? undefined : input.onRequest)
  const onBeforeResponseHooks = toArray(typeof input === 'function' ? undefined : input.onBeforeResponse)
  delete rest.onRequest
  delete rest.onBeforeResponse

  return defineHandler({
    ...rest,
    async handler (input: H3Event) {
      const event = prepareLegacyEvent(input, getRouteRules) as LegacyH3Event
      try {
        for (const hook of onRequestHooks) {
          await hook(event)
        }
        const response = { body: await handler(event) }
        for (const hook of onBeforeResponseHooks) {
          await hook(event, response)
        }
        return withLegacyContentType(event, response.body)
      } catch (error) {
        throw toLegacyError(error)
      }
    },
  })
}

export const eventHandler = defineEventHandler
