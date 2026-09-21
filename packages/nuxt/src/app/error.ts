import type { NuxtErrorJSON, NuxtError as _NuxtErrorContract } from './types'
import { sanitizeStatusCode, sanitizeStatusMessage } from './utils/http-status'

export const NUXT_ERROR_SIGNATURE = '__nuxt_error' as const

/**
 * Details accepted when constructing a {@link NuxtError}.
 *
 * @since 5.0.0
 */
export type NuxtErrorDetails<DataT = unknown> = Partial<Omit<NuxtError<DataT>, 'headers' | 'name' | 'toJSON'>> & {
  /** @deprecated use `status` */
  statusCode?: number
  /** @deprecated use `statusText` */
  statusMessage?: string
  headers?: HeadersInit
}

export class NuxtError<DataT = unknown> extends Error implements _NuxtErrorContract<DataT> {
  readonly [NUXT_ERROR_SIGNATURE] = true as const

  /**
   * h3 recognises its own errors by constructor name rather than `instanceof`,
   * so errors thrown during SSR are only mapped to the right HTTP response if
   * `name` stays `HTTPError`.
   */
  override get name (): string {
    return 'HTTPError'
  }

  /** HTTP status code in range [100...599] */
  readonly status: number
  /** HTTP status text (reason phrase) */
  readonly statusText: string | undefined
  /** Additional HTTP headers to be sent with the error response. */
  readonly headers: Headers | undefined
  /** Additional data attached to the error JSON body under `data`. */
  readonly data: DataT | undefined
  /** Additional top-level properties to attach to the error JSON body. */
  readonly body: Record<string, unknown> | undefined
  /** Whether the error was not handled by the application. */
  readonly unhandled: boolean | undefined
  readonly fatal: boolean
  override readonly cause: unknown

  constructor (message: string | NuxtErrorDetails<DataT> = '', opts: NuxtErrorDetails<DataT> = {}) {
    const details = (typeof message === 'string' ? opts : message) || {}
    const cause = details.cause as NuxtErrorDetails<DataT> | undefined

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const status = sanitizeStatusCode(details.status || details.statusCode || cause?.status || cause?.statusCode, 500)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const statusText = sanitizeStatusMessage(details.statusText || details.statusMessage || cause?.statusText || cause?.statusMessage)

    super(
      (typeof message === 'string' ? message : '') ||
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      details.message || cause?.message || details.statusText || details.statusMessage ||
      ['HTTPError', status, statusText].filter(Boolean).join(' '),
      { cause: details },
    )

    this.status = status
    this.statusText = statusText || undefined
    const headers = details.headers || cause?.headers
    this.headers = headers ? new Headers(headers) : undefined
    this.unhandled = details.unhandled ?? cause?.unhandled ?? undefined
    this.data = details.data
    this.body = details.body
    this.cause = details instanceof Error ? details : details.cause
    this.fatal = details.fatal ?? !!this.unhandled
  }

  /** @deprecated use `status` */
  get statusCode (): number {
    return this.status
  }

  /** @deprecated use `statusText` */
  get statusMessage (): string | undefined {
    return this.statusText
  }

  toJSON (): NuxtErrorJSON {
    const unhandled = this.unhandled
    return {
      status: this.status,
      statusText: this.statusText,
      unhandled,
      message: unhandled ? 'HTTPError' : this.message,
      data: unhandled ? undefined : this.data,
      ...unhandled ? undefined : this.body,
    }
  }
}

/** @since 3.0.0 */
export const isNuxtError = <DataT = unknown>(error: unknown): error is NuxtError<DataT> => {
  return !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error
}

/**
 * Construct an error carrying an HTTP status, to show on the error page or to
 * throw from a server handler.
 *
 * The error reports `HTTPError` as its `name`, which is how h3 and the server
 * runtime recognise it and map it to the response its `status`, `statusText`,
 * `headers` and `data` describe. Anything attached to `data` reaches the
 * client, so only attach what the client may see.
 *
 * An error that already carries a status is returned unchanged.
 *
 * @example
 * ```ts
 * throw createError({ status: 404, statusText: 'Not Found' })
 * ```
 *
 * @since 3.0.0
 */
export const createError = <DataT = unknown>(error: string | Error | NuxtErrorDetails<DataT>): NuxtError<DataT> => {
  if (isNuxtError<DataT>(error)) { return error }
  return typeof error === 'string'
    ? new NuxtError<DataT>(error)
    : new NuxtError<DataT>((error as NuxtErrorDetails<DataT> | null)?.message ?? '', (error ?? {}) as NuxtErrorDetails<DataT>)
}

/** Set in development on an error created from a thrown value that was not an `Error`. */
export const THROWN_VALUE = Symbol.for('nuxt:dev:thrown')

/** Set in development to where the app was when it threw. */
export const THROWN_CONTEXT = Symbol.for('nuxt:dev:context')

/** Where the app was when it threw. */
export interface ThrownContext {
  /** The component instance that raised or captured the error. */
  instance?: unknown
  /** The route being rendered. */
  route?: unknown
}

/**
 * Wrap whatever the app threw, remembering in development the thrown value and where the
 * app was, for the error report. Outside development this is {@link createError}, so the
 * wrapper leaves no trace in a production bundle.
 *
 * @internal
 */
export const createErrorFromThrown: (thrown: unknown, context?: ThrownContext) => NuxtError = import.meta.dev
  ? function createErrorFromThrown (thrown: unknown, context?: ThrownContext): NuxtError {
    const error = createError(thrown as string | Error | NuxtErrorDetails)
    if (error !== thrown && !(thrown instanceof Error)) {
      Object.defineProperty(error, THROWN_VALUE, { value: thrown, configurable: true })
    }
    if (context && (context.instance || context.route) && !(THROWN_CONTEXT in error)) {
      Object.defineProperty(error, THROWN_CONTEXT, { value: context, configurable: true })
    }
    return error
  }
  : createError as (thrown: unknown) => NuxtError
