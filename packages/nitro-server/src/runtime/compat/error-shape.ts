import { HTTPError } from 'nitro/h3'

// Error normalisation shared by the h3 v1 shim, the handler wrapper and Nuxt's error
// handler, and kept free of the rest of the compat runtime so that normalising a thrown
// error does not pull the shim into every server bundle.

export interface H3ErrorInput {
  message?: string
  statusCode?: number
  statusMessage?: string
  status?: number
  statusText?: string
  data?: any
  cause?: unknown
  fatal?: boolean
  unhandled?: boolean
  headers?: HeadersInit
  [key: string]: any
}

const kLegacyShape = Symbol.for('nuxt.compat.h3v1.error')

/** v1 input carries `statusCode`/`statusMessage`, where v3 carries `status`/`statusText`. */
function hasLegacyErrorKeys (input: unknown): boolean {
  return !!input && typeof input === 'object' && ('statusCode' in input || 'statusMessage' in input || 'fatal' in input)
}

/**
 * v1-shaped `createError`, returning an `HTTPError` whose serialised body keeps the v1 key
 * names alongside the v2 ones. Input that is already v3-shaped is passed through
 * untouched, since the extra body keys are an observable change migrated code did not ask for.
 */
export function createError (input: string | (Error & H3ErrorInput) | H3ErrorInput): HTTPError {
  if (HTTPError.isError(input)) {
    return input as HTTPError
  }

  const error = new HTTPError(input as any)
  if (!hasLegacyErrorKeys(input)) {
    return error
  }

  if (typeof input === 'object' && input.fatal !== undefined) {
    Object.defineProperty(error, 'fatal', { value: input.fatal, configurable: true, enumerable: false })
  }

  return withLegacyErrorShape(error)
}

/** Serialise an error with the v1 body keys as well as the v2 ones. */
export function withLegacyErrorShape<T extends HTTPError> (error: T): T {
  if ((error as any)[kLegacyShape]) {
    return error
  }
  const toJSON = error.toJSON.bind(error)
  Object.defineProperties(error, {
    [kLegacyShape]: { value: true },
    toJSON: {
      configurable: true,
      value: () => {
        const json = toJSON()
        return {
          ...json,
          statusCode: json.status,
          statusMessage: json.statusText,
        }
      },
    },
  })
  return error
}

/**
 * An h3 v1 error, by the test h3 v1 itself used: a static on the class, so a copy of h3 v1
 * bundled into a module's own output is recognised as well.
 *
 * Nothing else may be trusted. `{ statusCode, statusMessage, message, data }` is also the
 * shape of an ofetch `FetchError` and of a parsed upstream payload, and h3 v1 marked both
 * as unhandled, which is what kept the upstream URL, message and body out of the response.
 * Recovering a status from them would publish the message alongside it.
 */
function isLegacyH3Error (input: unknown): boolean {
  return !!input && typeof input === 'object'
    && (input as { constructor?: { __h3_error__?: unknown } }).constructor?.__h3_error__ === true
}

/**
 * Rebuild an h3 v1 error as an `HTTPError`. `headers` are dropped: this runs on arbitrary
 * thrown values, and a rethrown upstream payload must not set response headers on the app.
 */
function fromLegacyH3Error (cause: H3ErrorInput): HTTPError {
  const { headers: _headers, ...details } = cause
  return withLegacyErrorShape(new HTTPError({
    ...details,
    message: cause.message,
    status: cause.statusCode,
    statusText: cause.statusMessage,
    cause,
  }))
}

/**
 * Wrap a foreign value as h3 wraps a foreign error: an unhandled 500. The marker is what
 * keeps the message and `data` out of the response body, so a thrown `Error` does not
 * publish its internals to the client.
 */
function toUnhandledError (input: unknown): HTTPError {
  const message = input instanceof Error ? input.message : typeof input === 'string' ? input : undefined
  const error = new HTTPError({ status: 500, message, cause: input, unhandled: true })
  if (input instanceof Error && input.stack) {
    error.stack = input.stack
  }
  return error
}

/**
 * Wrap a foreign value that carries a status of its own: an ofetch `FetchError`, a plain
 * object, a rethrown upstream payload.
 *
 * h3 v1 marked all of these unhandled, so nitro v2 answered with the status they carry but
 * with `message: 'Server Error'` and no `data`. An ofetch message names the URL it called,
 * so that scrubbing is load-bearing. Nitro v3 answers an unhandled error with a bare 500
 * instead, so the status is kept here and the message and `data` are dropped in its place.
 *
 * `cause` is attached after construction: as a constructor detail it would supply the
 * message, `data` and response headers back again.
 */
function toScrubbedStatusError (input: Error & H3ErrorInput, status: number): HTTPError {
  const statusText = typeof input.statusText === 'string' ? input.statusText : typeof input.statusMessage === 'string' ? input.statusMessage : undefined
  const error = withLegacyErrorShape(new HTTPError({ status, statusText, message: 'Server Error' }))
  Object.defineProperty(error, 'cause', { value: input, configurable: true, writable: true })
  if (input.stack) {
    error.stack = input.stack
  }
  return error
}

/**
 * Coerce a thrown value into something h3 v2 recognises as an HTTP error. An h3 v1 error is
 * recognised without being an instance of the h3 the app runs, so a copy bundled into a
 * module's own output keeps the status it carries instead of surfacing as a 500. Every
 * other value is left unhandled, as h3 v1 and h3 v2 both leave it.
 */
export function toLegacyError (input: unknown): HTTPError {
  if (HTTPError.isError(input)) {
    const error = input as HTTPError
    // h3 wraps a foreign error as an unhandled 500, which loses the status a wrapped h3 v1
    // error carries
    if (error.unhandled && isLegacyH3Error(error.cause)) {
      return fromLegacyH3Error(error.cause as H3ErrorInput)
    }
    return error
  }

  if (isLegacyH3Error(input)) {
    return fromLegacyH3Error(input as H3ErrorInput)
  }

  const foreign = input as (Error & H3ErrorInput) | null | undefined
  const status = typeof foreign?.status === 'number' ? foreign.status : typeof foreign?.statusCode === 'number' ? foreign.statusCode : undefined
  if (status === undefined) {
    return toUnhandledError(input)
  }

  return toScrubbedStatusError(foreign!, status)
}
