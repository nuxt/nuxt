import type { ErrorReport } from 'my-bad'
import type { SerializedErrorCause } from 'nuxt/internal/dev-error'

export const REMOTE_DEV_ERROR_EVENT = 'nuxt:vite-server:dev-error'
export const REMOTE_DEV_ERROR_REPORT_EVENT = 'nuxt:vite-server:dev-error:report'
export const REMOTE_DEV_ERROR_CLEAR_EVENT = 'nuxt:vite-server:dev-error:clear'

export interface RemoteDevError {
  id: string
  error: SerializedErrorCause | undefined
  status?: number
  request?: { method: string, url: string, headers: [string, string][] }
}

export interface RemoteDevErrorReport {
  id: string
  report?: ErrorReport
  /** Added before the end of the page's `<body>`. */
  overlay?: string
  page?: string
}

export function deserializeError (serialized: SerializedErrorCause | undefined): unknown {
  if (!serialized || typeof serialized !== 'object') {
    return serialized
  }
  const { cause, ...properties } = serialized
  return Object.assign(new Error(serialized.message, cause === undefined ? undefined : { cause: deserializeError(cause) }), properties)
}
