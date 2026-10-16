import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
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
  const dir = typeof options.publicDir === 'string' ? options.publicDir : fileURLToPath(options.publicDir)
  const serveStatic = staticMiddleware({ dir })
  const publicFiles = listFiles(dir)

  return {
    fetch: async (request: Request) => {
      const files = await publicFiles
      if (!files || mayBeStaticFile(files, request)) {
        return serveStatic(request as never, () => options.fetch(request))
      }
      return options.fetch(request)
    },
  }
}

async function listFiles (dir: string): Promise<Set<string> | undefined> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true })
    const files = new Set<string>()
    for (const entry of entries) {
      if (entry.isFile()) {
        files.add('/' + relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
      }
    }
    return files
  } catch {
    return undefined
  }
}

/** Whether the request path, or one of the variants the static handler tries, is a public file. */
function mayBeStaticFile (files: Set<string>, request: Request): boolean {
  let path: string
  try {
    path = decodeURIComponent(new URL(request.url).pathname)
  } catch {
    return true
  }
  if (path.endsWith('/')) {
    return files.has(path + 'index.html')
  }
  return files.has(path) || files.has(path + '.html') || files.has(path + '/index.html')
}

/** Listen for requests, using the port and host the platform environment configures. */
export function listen (server: { fetch: (request: Request) => Response | Promise<Response> }): void {
  serve({ fetch: server.fetch as never })
}
