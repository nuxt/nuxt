import type { ServerRequest } from 'nitro/types'
import { isLoopbackAddress } from 'nuxt/internal/dev/peer'
import { useErrorChannel } from '../utils/error-channel'

/**
 * Serves the live error channel: the SSE stream, report lookups and "open in editor".
 *
 * The channel answers for reports other requests produced, so it requires a loopback peer:
 * the origin headers it checks itself are all forgeable over a direct connection, and a
 * dev server started with `--host` is reachable from the network.
 */
export default {
  async fetch (request: ServerRequest): Promise<Response> {
    if (!isLoopbackAddress(request.ip)) {
      return new Response('Forbidden', { status: 403 })
    }
    const channel = await useErrorChannel()
    const response = await channel.fetchHandler(request as unknown as Request)
    return response ?? new Response('Not Found', { status: 404 })
  },
}
