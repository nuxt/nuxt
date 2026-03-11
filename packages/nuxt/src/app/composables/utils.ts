/**
 * Composable utilities for Nuxt app
 */

/**
 * Resolve composable name to standard format
 * Validates and normalizes composable names (must start with 'use')
 */
export function resolveComposableName (name: string): string {
  if (!name) {
    throw new Error('Composable name is required')
  }
  if (!/^[a-zA-Z]/.test(name)) {
    throw new Error('Composable name must start with a letter')
  }
  // Normalize: convert first char to lowercase for non-all-caps
  if (name === name.toUpperCase() && name !== name.toLowerCase()) {
    // All caps: convert to lowercase
    return name.toLowerCase()
  }
  // PascalCase: first char lowercase
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/**
 * Check if a value is a valid composable function
 */
export function isValidComposable (value: unknown): value is () => unknown {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value !== 'function') {
    return false
  }
  return true
}

/**
 * Extract metadata from a composable function
 */
export function extractComposableMeta (
  composable: unknown
): { name?: string; version?: string } {
  if (!composable || typeof composable !== 'function') {
    return {}
  }
  const fn = composable as { meta?: { name?: string; version?: string } }
  return fn.meta || {}
}

/**
 * Validate composable options
 */
export function validateComposableOptions (options: {
  name: string
  lazy?: boolean
}): boolean {
  if (!options || typeof options !== 'object') {
    throw new Error('Options must be an object')
  }
  if (!options.name || typeof options.name !== 'string') {
    throw new Error('name is required and must be a string')
  }
  if (options.lazy !== undefined && typeof options.lazy !== 'boolean') {
    throw new Error('lazy must be a boolean')
  }
  return true
}
