export type ErrorDefinition = {
  code: string
  message?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
  /** A hint to help the user understand the issue */
  hint?: string
  /** Why the issue occurred — the underlying reason */
  why?: string
  /** A documentation URL (overrides code-derived URL) */
  docs?: string
}

export type EmitContext = Omit<ErrorDefinition, 'code'> & {
  /** Extra data to be interpolated into the message/fix/hint/why */
  data?: Record<string, unknown>
  /** Extra debug data included in the diagnostic only when verbose mode is enabled */
  debug?: Record<string, unknown>
  /** The original error that caused this diagnostic */
  cause?: unknown
  /** Stack trace: string to use as-is, or boolean to control automatic capture */
  stack?: string | boolean
}

/** The final diagnostic object that is emitted */
export type Diagnostic = {
  code: string
  message?: string
  fix?: string
  hint?: string
  why?: string
  docs?: string
  data?: Record<string, unknown>
  debug?: Record<string, unknown>
  cause?: unknown
  stack?: string
}

export interface CreateLogOptions<Errors extends Record<string, ErrorDefinition>> {
  /**
   * Module identifier used as the error tag prefix.
   * The value is uppercased automatically.
   *
   * @example 'NUXT'   // → [NUXT_B1001]
   * @example 'pinia'  // → [PINIA_001]
   */
  prefix: string
  /**
   * When true, includes `debug` data in diagnostics.
   * Typically set to `isDebug || isAgent` from `std-env`.
   */
  verbose: boolean
  /**
   * Base URL generator for auto-generating docs links from error codes.
   *
   * @example (code) => `https://nuxt.com/e/${code}`
   */
  docs?: (code: string) => string
  /** Error definitions keyed by error code (e.g., `{ B1001: { code: 'B1001', ... } }`) */
  errors?: Errors
  /**
   * Called when a diagnostic is emitted via `emit()` or `fatal()`.
   * Build-time: prints via consola. Runtime: forwards to server or console.
   */
  onEmit?: (diag: Diagnostic) => void
}

/**
 * Replace `{key}` placeholders in a template string with values from `data`.
 * Unmatched keys are left as-is.
 */
export function interpolate (template: string, data?: Record<string, unknown>): string {
  if (!data) { return template }
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

function interpolateOptional (template: string | undefined, data?: Record<string, unknown>): string | undefined {
  if (!template) { return template }
  return interpolate(template, data)
}

/**
 * Resolve an error code and optional emit context into a full `Diagnostic` object.
 *
 * - Looks up the `ErrorDefinition` from `options.errors[code]`
 * - Merges with `EmitContext` overrides (context wins over definition)
 * - Interpolates all string fields (`message`, `fix`, `hint`, `why`) with `ctx.data`
 * - Computes `url` from `options.docs(code)` unless overridden
 * - Includes `debug` data only when `options.verbose` is true
 */
export function resolve<Errors extends Record<string, ErrorDefinition>> (options: CreateLogOptions<Errors>, code: keyof Errors, ctx?: EmitContext): Diagnostic {
  const def = options.errors?.[code]
  const data = ctx?.data

  const message = interpolateOptional(ctx?.message ?? def?.message, data)
  const fix = interpolateOptional(ctx?.fix ?? def?.fix, data)
  const hint = interpolateOptional(ctx?.hint ?? def?.hint, data)
  const why = interpolateOptional(ctx?.why ?? def?.why, data)
  const docs = ctx?.docs ?? def?.docs
  const url = docs ?? options.docs?.(code as string)

  let stack: string | undefined
  if (typeof ctx?.stack === 'string') {
    stack = ctx.stack
  }

  return {
    code: code as string,
    message,
    fix,
    hint,
    why,
    docs,
    data,
    debug: options.verbose ? ctx?.debug : undefined,
    cause: ctx?.cause,
    stack,
  }
}

export interface Log<Errors extends Record<string, ErrorDefinition>> {
  /** Emit a diagnostic (warn-level). Calls `onEmit` with the resolved diagnostic. */
  emit: (code: keyof Errors, ctx?: EmitContext) => Diagnostic
  /** Emit a diagnostic then throw an Error with `.code` and `.diagnostic` attached. */
  throw: (code: keyof Errors, ctx?: EmitContext) => never
  /** Resolve a diagnostic without emitting it. */
  resolve: (code: keyof Errors, ctx?: EmitContext) => Diagnostic
}

/**
 * Create a set of diagnostic utilities scoped to a specific module.
 *
 * @example
 * ```ts
 * const log = createLog({
 *   prefix: 'NUXT',
 *   verbose: isDebug || isAgent,
 *   docs: (code) => `https://nuxt.com/e/${code}`,
 *   errors: errorCodes,
 *   onEmit(diag) { logger.warn(formatDiagnostic('NUXT', diag, verbose)) },
 * })
 *
 * log.emit('B1001', { data: { template: 'my-template' } })
 * log.fatal('B1001', { data: { template: 'my-template' } })
 * ```
 */
export function createLog<Errors extends Record<string, ErrorDefinition>> (options: CreateLogOptions<Errors>): Log<Errors> {
  function _resolve (code: keyof Errors, ctx?: EmitContext): Diagnostic {
    return resolve<Errors>(options, code, ctx)
  }

  function emit (code: keyof Errors, ctx?: EmitContext): Diagnostic {
    const diag = _resolve(code, ctx)
    options.onEmit?.(diag)
    return diag
  }

  function fatal (code: keyof Errors, ctx?: EmitContext): never {
    const diag = _resolve(code, ctx)
    options.onEmit?.(diag)

    const msg = diag.message
      ? `[${options.prefix}_${code as string}] ${diag.message}`
      : `[${options.prefix}_${code as string}]`
    const err = new Error(msg, { cause: ctx?.cause })
    ;(err as any).code = `${options.prefix}_${code as string}`
    ;(err as any).diagnostic = diag
    throw err
  }

  return { emit, throw: fatal, resolve: _resolve }
}
