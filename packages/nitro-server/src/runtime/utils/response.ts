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
