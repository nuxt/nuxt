import type { ServerRequest } from 'nitro/types'
import { DEV_PEER_HEADER, isVouchedLoopbackPeer } from 'nuxt/internal/dev/peer'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Serves the live error channel: the SSE stream, report lookups and "open in editor".
 *
 * Trust follows the socket the dev server in front accepted, since a request's origin
 * headers are forgeable over a direct connection.
 */
export default {
  async fetch (request: ServerRequest): Promise<Response> {
    const channel = await useErrorChannel()
    const trusted = isVouchedLoopbackPeer(request.headers.get(DEV_PEER_HEADER))
    const response = await channel.fetchHandler(request as unknown as Request, { trusted })
    return response ?? new Response('Not Found', { status: 404 })
  },
}
