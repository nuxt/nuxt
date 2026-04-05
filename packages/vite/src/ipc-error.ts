type ViteErrorLoc = {
  file?: string
  id?: string
  url?: string
  line?: number | string
  column?: number | string
}

export type SerializedIPCError = {
  message: string
  stack?: string
  status?: number
  statusCode?: number
  statusText?: string
  data?: unknown
  name?: string
  code?: string | number
  cause?: SerializedIPCError
  plugin?: string
  id?: string
  loc?: ViteErrorLoc
  frame?: string
}

function toSafeJSONValue (value: unknown) {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function toSerializableCause (cause: unknown, depth: number): SerializedIPCError | undefined {
  if (!cause || depth > 4) {
    return
  }

  if (cause instanceof Error || typeof cause === 'object') {
    return serializeIPCError(cause, depth)
  }

  return {
    message: String(cause),
  }
}

export function serializeIPCError (error: unknown, depth = 0): SerializedIPCError {
  const err = error as any
  const message = typeof err?.message === 'string'
    ? err.message
    : String(error || 'Unknown IPC error')

  return {
    message,
    stack: typeof err?.stack === 'string' ? err.stack : undefined,
    status: typeof err?.status === 'number' ? err.status : undefined,
    statusCode: typeof err?.statusCode === 'number' ? err.statusCode : undefined,
    statusText: typeof err?.statusText === 'string' ? err.statusText : undefined,
    data: toSafeJSONValue(err?.data),
    name: typeof err?.name === 'string' ? err.name : undefined,
    code: typeof err?.code === 'string' || typeof err?.code === 'number' ? err.code : undefined,
    cause: toSerializableCause(err?.cause, depth + 1),
    plugin: typeof err?.plugin === 'string' ? err.plugin : undefined,
    id: typeof err?.id === 'string' ? err.id : undefined,
    loc: err?.loc && typeof err.loc === 'object' ? toSafeJSONValue(err.loc) as ViteErrorLoc : undefined,
    frame: typeof err?.frame === 'string' ? err.frame : undefined,
  }
}

export function deserializeIPCError (serializedError: SerializedIPCError): Error & {
  stack?: string
  data?: unknown
  status?: number
  statusCode?: number
  statusText?: string
  code?: string | number
  plugin?: string
  id?: string
  loc?: ViteErrorLoc
  frame?: string
} {
  const err = new Error(serializedError.message)
  err.name = serializedError.name || err.name

  const hydrated = err as Error & {
    stack?: string
    data?: unknown
    status?: number
    statusCode?: number
    statusText?: string
    code?: string | number
    cause?: unknown
    plugin?: string
    id?: string
    loc?: ViteErrorLoc
    frame?: string
  }

  hydrated.stack = serializedError.stack
  hydrated.data = serializedError.data
  hydrated.statusCode = hydrated.status = serializedError.status || serializedError.statusCode
  hydrated.statusText = serializedError.statusText
  hydrated.code = serializedError.code
  hydrated.plugin = serializedError.plugin
  hydrated.id = serializedError.id
  hydrated.loc = serializedError.loc
  hydrated.frame = serializedError.frame

  if (serializedError.cause) {
    hydrated.cause = deserializeIPCError(serializedError.cause)
  }

  return hydrated
}