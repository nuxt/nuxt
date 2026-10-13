import type { H3Event } from 'h3'

/**
 * The response the renderer builds, keeping its body as the renderer produced it.
 *
 * A real `Response` turns every body into a `ReadableStream`, which would send a rendered
 * document as a chunked stream where nitro sends the string it was given. The renderer only
 * reads the fields below back, so this describes just those.
 */
export class NodeRenderResponse {
  readonly status: number
  readonly statusText: string
  readonly headers: Headers

  constructor (readonly body: BodyInit | null, init?: ResponseInit) {
    this.status = init?.status || 200
    this.statusText = init?.statusText || ''
    this.headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers)
  }
}

/**
 * The headers of a node response as the record nitro's `render:response` hook passes,
 * read from and written to the node response itself. `set-cookie` is omitted, as it
 * cannot be represented as one string. The proxy target is kept as a snapshot for
 * `util.inspect`, which bypasses the traps.
 */
export function createResponseHeaderRecord (res: H3Event['node']['res']): Record<string, string> {
  const read = (name: string | symbol): string | undefined => {
    if (typeof name !== 'string' || name.toLowerCase() === 'set-cookie') { return }
    const value = res.getHeader(name)
    if (value === undefined) { return }
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  const snapshot: Record<string, string> = {}
  const sync = (name: string) => {
    const value = read(name)
    if (value === undefined) {
      delete snapshot[name.toLowerCase()]
    } else {
      snapshot[name.toLowerCase()] = value
    }
  }
  for (const name of res.getHeaderNames()) {
    sync(name)
  }

  return new Proxy(snapshot, {
    get: (_, name) => read(name),
    has: (_, name) => read(name) !== undefined,
    set (_, name, value) {
      if (typeof name === 'string') {
        if (value === undefined || value === null) {
          res.removeHeader(name)
        } else {
          res.setHeader(name, value)
        }
        sync(name)
      }
      return true
    },
    deleteProperty (_, name) {
      if (typeof name === 'string') {
        res.removeHeader(name)
        sync(name)
      }
      return true
    },
    ownKeys: () => res.getHeaderNames().filter(name => name !== 'set-cookie'),
    getOwnPropertyDescriptor (_, name) {
      const value = read(name)
      return value === undefined ? undefined : { value, writable: true, enumerable: true, configurable: true }
    },
  })
}
