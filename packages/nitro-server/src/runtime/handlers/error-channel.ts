import type { ServerRequest } from 'nitro/types'
import { useErrorChannel } from '../utils/error-channel'

/** Serves the live error channel: the SSE stream, report lookups and "open in editor". */
export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const channel = await useErrorChannel()
    const response = await channel.fetchHandler(request as unknown as Request)
    return response ?? new Response('Not Found', { status: 404 })
  },
}
