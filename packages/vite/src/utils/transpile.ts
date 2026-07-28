import { useNuxt } from '@nuxt/kit'
import escapeRegExp from 'escape-string-regexp'
import { normalize } from 'pathe'

interface Envs {
  isDev: boolean
  isClient?: boolean
  isServer?: boolean
}

export function getTranspilePatterns (envs: Envs): Array<string | RegExp> {
  const nuxt = useNuxt()
  const transpile: RegExp[] = []

  for (let pattern of nuxt.options.build.transpile) {
    if (typeof pattern === 'function') {
      const result = pattern(envs)
      if (result) { pattern = result }
    }
    if (typeof pattern === 'string') {
      transpile.push(new RegExp(escapeRegExp(normalize(pattern))))
    } else if (pattern instanceof RegExp) {
      transpile.push(pattern)
    }
  }

  return transpile
}

/**
 * Get transpile patterns as strings for use with Vite's optimizeDeps.exclude
 * This resolves functions and filters to only string patterns
 */
export function getTranspileStrings (envs: Envs): string[] {
  const nuxt = useNuxt()
  const patterns: string[] = []

  for (let pattern of nuxt.options.build.transpile) {
    if (typeof pattern === 'function') {
      const result = pattern(envs)
      if (result) { pattern = result }
    }
    if (typeof pattern === 'string') {
      patterns.push(normalize(pattern))
    }
  }

  return patterns
}
