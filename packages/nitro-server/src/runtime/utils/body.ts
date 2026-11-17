import type { H3Event } from 'nitro/h3'

const BUFFERED = Symbol.for('nuxt.bufferedRequestBody')

const BODY_READ_METHODS = new Set(['arrayBuffer', 'blob', 'bytes', 'formData', 'json', 'text'])

/**
 * Serve every read of the event's body from one buffered copy, so that reading it through
 * the web request and through `readBody()`, or from a middleware and then from the route
 * handler, resolves the same bytes in either order. The bytes are read lazily and
 * incrementally, only as far as a read of the body has requested them.
 */
export function bufferRequestBody (event: H3Event): void {
  const request = event.req
  if (!request.body || BUFFERED in request) {
    return
  }

  const chunks: Uint8Array<ArrayBuffer>[] = []
  let source: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | undefined
  let done = false
  let pending: Promise<void> | undefined

  const readChunk = () => (pending ??= (source ??= request.body!.getReader()).read().then((result) => {
    if (result.done) {
      done = true
    } else {
      chunks.push(result.value)
    }
  }).finally(() => {
    pending = undefined
  }))

  const copy = async () => {
    while (!done) {
      await readChunk()
    }
    return new Response(new Blob(chunks), { headers: request.headers })
  }

  const stream = () => {
    let index = 0
    return new ReadableStream<Uint8Array>({
      async pull (controller) {
        while (index >= chunks.length && !done) {
          await readChunk()
        }
        if (index < chunks.length) {
          controller.enqueue(chunks[index++]!.slice())
        } else {
          controller.close()
        }
      },
    }, { highWaterMark: 0 })
  }

  ;(event as { req: H3Event['req'] }).req = new Proxy(request, {
    get (target, property) {
      if (property === BUFFERED) {
        return true
      }
      if (property === 'bodyUsed') {
        return false
      }
      if (property === 'body') {
        return stream()
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
