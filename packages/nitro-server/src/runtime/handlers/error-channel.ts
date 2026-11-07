import { defineEventHandler, getRequestHeader, toWebRequest } from 'h3'
import { DEV_PEER_HEADER, isVouchedLoopbackPeer } from 'nuxt/internal/dev/peer'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Serves the live error channel: the SSE stream, report lookups and "open in editor".
 *
 * Trust follows the socket the dev server in front accepted, since a request's origin
 * headers are forgeable over a direct connection.
 */
export default defineEventHandler(async (event): Promise<Response> => {
  const channel = await useErrorChannel()
  const trusted = isVouchedLoopbackPeer(getRequestHeader(event, DEV_PEER_HEADER))
  const response = await channel.fetchHandler(toWebRequest(event), { trusted })
  return response ?? new Response('Not Found', { status: 404 })
})
