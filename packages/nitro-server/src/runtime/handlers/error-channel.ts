import type { ServerRequest } from 'nitro/types'
import { isLoopbackAddress } from 'nuxt/internal/dev/peer'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Serves the live error channel: the SSE stream, report lookups and "open in editor".
 *
 * Trust follows the socket, since a request's origin headers are forgeable over a direct
 * connection.
 */
export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const channel = await useErrorChannel()
    const trusted = isLoopbackAddress(request.ip)
    const response = await channel.fetchHandler(request as unknown as Request, { trusted })
    return response ?? new Response('Not Found', { status: 404 })
  },
}
