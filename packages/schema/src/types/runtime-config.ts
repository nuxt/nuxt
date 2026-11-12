/**
 * A compact description of a runtime config value, which the server applies environment
 * variables against on startup.
 *
 * - `'s'`, `'n'`, `'i'`, `'b'`, `'z'`: string, number, integer, boolean and `null`
 * - `'*'`: any value
 * - `{ e }`: one of the listed values
 * - `{ o }`: any of the listed schemas, tried in order
 * - `{ a }`: an array of the given schema
 * - `{ p, r, d }`: an object with the given properties, of which `r` are required, and `d` are
 *   the defaults of its properties
 */
export type RuntimeConfigSchemaNode =
  | 's' | 'n' | 'i' | 'b' | 'z' | '*'
  | { e: unknown[] }
  | { o: RuntimeConfigSchemaNode[] }
  | { a: RuntimeConfigSchemaNode }
  | RuntimeConfigSchemaObject

export interface RuntimeConfigSchemaObject {
  p: Record<string, RuntimeConfigSchemaNode>
  r?: string[]
  d?: Record<string, unknown>
}

/** A schema declared at a path within `runtimeConfig`. */
export interface RuntimeConfigSchemaEntry {
  path: string[]
  node: RuntimeConfigSchemaNode
  /** Whether a value must be provided at runtime, as the schema has no default. */
  required: boolean
  /** Whether the schema was set by a module with `updateRuntimeConfig`, rather than in `nuxt.config`. */
  module?: boolean
}
