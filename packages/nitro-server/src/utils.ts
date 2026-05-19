import { fileURLToPath } from 'node:url'
import { dirname } from 'pathe'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Build the `resolve.conditions` array applied to the SSR vite environment.
 *
 * `'import'` is required so that packages whose top-level `exports` map is
 * keyed only by `import`/`require` (notably `vue` and `vue-router`) resolve
 * when the only available copy is nested under `nuxt`'s own `node_modules`.
 */
export function getSsrResolveConditions (exportConditions?: string[]): string[] {
  const conditions = [...exportConditions || []]
  if (!conditions.includes('import')) {
    conditions.push('import')
  }
  return conditions
}

let _distDir = dirname(fileURLToPath(import.meta.url))
if (/(?:chunks|shared)$/.test(_distDir)) { _distDir = dirname(_distDir) }

export const distDir = _distDir
