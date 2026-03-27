export type ErrorDefinition = {
  code: string
  message?: string
  fix?: string
  hint?: string
  why?: string
  docs?: string
}

export type EmitContext = Omit<ErrorDefinition, 'code'> & {
  data?: Record<string, unknown>
  debug?: Record<string, unknown>
  cause?: Error
  stack?: string | boolean
}

export type Diagnostic = {
  code: string
  message?: string
  fix?: string
  hint?: string
  why?: string
  docs?: string
  url?: string
  data?: Record<string, unknown>
  debug?: Record<string, unknown>
  cause?: Error
  stack?: string
}

export interface CreateLogOptions {
  prefix: string
  verbose: boolean
  docs?: (code: string) => string
  errors?: Record<string, ErrorDefinition>
  onEmit?: (diag: Diagnostic) => void
}

export function interpolate(template: string, data?: Record<string, unknown>): string {
  if (!data) { return template }
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

function interpolateOptional(template: string | undefined, data?: Record<string, unknown>): string | undefined {
  if (!template) { return template }
  return interpolate(template, data)
}

export function resolve(options: CreateLogOptions, code: string, ctx?: EmitContext): Diagnostic {
  const def = options.errors?.[code]
  const data = ctx?.data

  const message = interpolateOptional(ctx?.message ?? def?.message, data)
  const fix = interpolateOptional(ctx?.fix ?? def?.fix, data)
  const hint = interpolateOptional(ctx?.hint ?? def?.hint, data)
  const why = interpolateOptional(ctx?.why ?? def?.why, data)
  const docs = ctx?.docs ?? def?.docs
  const url = docs ?? options.docs?.(code)

  let stack: string | undefined
  if (typeof ctx?.stack === 'string') {
    stack = ctx.stack
  }

  return {
    code,
    message,
    fix,
    hint,
    why,
    docs,
    url,
    data,
    debug: options.verbose ? ctx?.debug : undefined,
    cause: ctx?.cause,
    stack,
  }
}

export interface Log {
  emit: (code: string, ctx?: EmitContext) => void
  fatal: (code: string, ctx?: EmitContext) => never
  resolve: (code: string, ctx?: EmitContext) => Diagnostic
}

export function createLog(options: CreateLogOptions): Log {
  function _resolve(code: string, ctx?: EmitContext): Diagnostic {
    return resolve(options, code, ctx)
  }

  function emit(code: string, ctx?: EmitContext): void {
    const diag = _resolve(code, ctx)
    options.onEmit?.(diag)
  }

  function fatal(code: string, ctx?: EmitContext): never {
    const diag = _resolve(code, ctx)
    options.onEmit?.(diag)

    const msg = diag.message
      ? `[${options.prefix}_${code}] ${diag.message}`
      : `[${options.prefix}_${code}]`
    const err = new Error(msg, { cause: ctx?.cause })
    ;(err as any).code = `${options.prefix}_${code}`
    ;(err as any).diagnostic = diag
    throw err
  }

  return { emit, fatal, resolve: _resolve }
}
