import type { ServerRequest } from 'nitro/types'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Serves the live error channel in development: the SSE stream error pages
 * subscribe to, report lookups, and the "open in editor" action.
 */
export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const channel = await useErrorChannel()
    const response = await channel.fetchHandler(request as unknown as Request)
    return response ?? new Response('Not Found', { status: 404 })
  },
}
