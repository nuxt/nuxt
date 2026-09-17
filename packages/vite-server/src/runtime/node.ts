import { fileURLToPath } from 'node:url'
import { serve } from 'srvx/node'
import { staticMiddleware } from 'srvx/static'

/**
 * Serve the build's static assets, and hand everything else to the renderer.
 *
 * The static handler comes first so a request for a hashed asset never reaches a render.
 */
export function createNodeServer (options: {
  fetch: (request: Request) => Promise<Response>
  publicDir: string | URL
}): { fetch: (request: Request) => Response | Promise<Response> } {
  const serveStatic = staticMiddleware({ dir: typeof options.publicDir === 'string' ? options.publicDir : fileURLToPath(options.publicDir) })

  return {
    fetch: (request: Request) => serveStatic(request as never, () => options.fetch(request)),
  }
}

/** Listen for requests, using the port and host the platform environment configures. */
export function listen (server: { fetch: (request: Request) => Response | Promise<Response> }): void {
  serve({ fetch: server.fetch as never })
}
