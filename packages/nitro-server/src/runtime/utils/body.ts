import type { H3Event } from 'nitro/h3'

const BUFFERED = Symbol.for('nuxt.bufferedRequestBody')

const BODY_READ_METHODS = new Set(['arrayBuffer', 'blob', 'bytes', 'formData', 'json', 'text'])

/**
 * Serve every read of the event's body from one buffered copy, so that reading it through
 * the web request and through `readBody()`, or from a middleware and then from the route
 * handler, resolves the same bytes in either order. The bytes are read lazily, on the first
 * read of the body.
 */
export function bufferRequestBody (event: H3Event): void {
  const request = event.req
  if (!request.body || BUFFERED in request) {
    return
  }

  let buffered: Promise<ArrayBuffer> | undefined
  const read = () => (buffered ??= request.arrayBuffer())
  const copy = () => read().then(body => new Response(body, { headers: request.headers }))

  ;(event as { req: H3Event['req'] }).req = new Proxy(request, {
    get (target, property) {
      if (property === BUFFERED) {
        return true
      }
      if (property === 'bodyUsed') {
        return false
      }
      if (property === 'body') {
        return new ReadableStream<Uint8Array>({
          async pull (controller) {
            controller.enqueue(new Uint8Array(await read()))
            controller.close()
          },
        })
      }
      if (property === 'clone') {
        return () => event.req
      }
      if (typeof property === 'string' && BODY_READ_METHODS.has(property)) {
        return () => copy().then(response => response[property as 'text']())
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
    has (target, property) {
      return property === BUFFERED || Reflect.has(target, property)
    },
  }) as typeof event.req
}
