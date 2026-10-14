import type { H3Event } from 'nitro/h3'

interface LegacyHooks {
  callHook: (name: any, ...args: any[]) => unknown
}

/**
 * The payload nitro v2 passed to `render:response`. Typed here rather than declared on
 * `NitroRuntimeHooks`: the hook exists for nitro v2 module code, which types it against
 * nitropack v2, and Nuxt does not offer it to code written for this server.
 */
interface LegacyRenderResponse {
  body: string | undefined
  statusCode?: number
  statusMessage?: string
  headers: Record<string, string>
}

/**
 * Emit the nitro v2 `render:response` runtime hook, which nitro v2's
 * `defineRenderHandler` called with a mutable `{ body, statusCode, statusMessage, headers }`
 * object. Modules use it to set response headers computed from the rendered HTML
 * (`nuxt-security` sets `content-security-policy` with the nonce it injected during
 * `render:html`), so dropping it silently leaves markup claiming a nonce no header allows.
 *
 * Returns the body to send, which the hook may replace on non-streamed responses.
 */
export async function applyLegacyRenderResponse (event: H3Event, hooks: LegacyHooks, body: string | undefined): Promise<string | undefined> {
  const snapshot: Record<string, string> = Object.fromEntries(event.res.headers.entries())
  const headers: Record<string, string> = { ...snapshot }
  const response: LegacyRenderResponse = {
    body,
    statusCode: event.res.status,
    statusMessage: event.res.statusText,
    headers,
  }

  await hooks.callHook('render:response', response, { event })

  for (const header in response.headers) {
    const value = response.headers[header]
    if (value === undefined) {
      event.res.headers.delete(header)
    } else if (value !== snapshot[header] || !event.res.headers.has(header)) {
      event.res.headers.set(header, value)
    }
  }

  for (const header in snapshot) {
    if (!(header in response.headers)) {
      event.res.headers.delete(header)
    }
  }

  if (response.statusCode !== undefined && response.statusCode !== event.res.status) {
    event.res.status = response.statusCode
  }
  if (response.statusMessage !== undefined && response.statusMessage !== event.res.statusText) {
    event.res.statusText = response.statusMessage
  }

  // a streamed response has no swappable body, so a replacement is ignored
  if (body === undefined) {
    return undefined
  }

  return typeof response.body === 'string' ? response.body : body
}

const streamedResponses = new WeakSet<Response>()

/**
 * Mark a response whose body is being written as it is produced. Its body cannot be read
 * back: a clone tees the source, so reading one branch holds the response until the whole
 * render has finished.
 */
export function markStreamedResponse (response: Response): void {
  streamedResponses.add(response)
}

/** Whether the body of a response is a live stream rather than a value already in hand. */
export function isStreamedResponse (response: Response): boolean {
  return streamedResponses.has(response)
}

const renderBodies = new WeakMap<Response, string>()

/**
 * Remember the HTML a response was built from, so that the body can be offered to a
 * `render:response` listener without reading it back out of the `Response`.
 */
export function rememberRenderBody (response: Response, body: unknown): void {
  if (typeof body === 'string') {
    renderBodies.set(response, body)
  }
}

/**
 * Emit `render:response` for a response the Nuxt renderer produced and rebuild it from
 * `event.res`, which is first given the status and headers of the response. The body is
 * offered only when the response was built from a string.
 */
export async function applyLegacyRenderResponseTo (event: H3Event, hooks: LegacyHooks, response: Response, createResponse: (body: BodyInit | null, init?: ResponseInit) => Response): Promise<Response> {
  const body = renderBodies.get(response)

  event.res.status = response.status
  event.res.statusText = response.statusText || undefined
  replaceHeaders(event.res.headers, response.headers)

  const replaced = await applyLegacyRenderResponse(event, hooks, body)
  const rebuilt = createResponse(replaced ?? response.body, event.res)
  if (isStreamedResponse(response)) {
    markStreamedResponse(rebuilt)
  }
  return rebuilt
}

function replaceHeaders (target: Headers, source: Headers): void {
  for (const name of [...target.keys()]) {
    if (!source.has(name)) {
      target.delete(name)
    }
  }
  target.delete('set-cookie')
  for (const [name, value] of source) {
    if (name === 'set-cookie') {
      target.append(name, value)
    } else {
      target.set(name, value)
    }
  }
}
