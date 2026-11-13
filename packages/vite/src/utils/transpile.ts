import { useNuxt } from '@nuxt/kit'
import escapeRegExp from 'escape-string-regexp'
import { normalize } from 'pathe'

interface Envs {
  isDev: boolean
  isClient?: boolean
  isServer?: boolean
}

function resolveTranspile (envs: Envs): Array<string | RegExp> {
  const patterns: Array<string | RegExp> = []
  for (const entry of useNuxt().options.build.transpile) {
    const pattern = typeof entry === 'function' ? entry(envs) || undefined : entry
    if (typeof pattern === 'string') {
      patterns.push(normalize(pattern))
    } else if (pattern instanceof RegExp) {
      patterns.push(pattern)
    }
  }
  return patterns
}

export function getTranspilePatterns (envs: Envs): RegExp[] {
  return resolveTranspile(envs).map(pattern => typeof pattern === 'string' ? new RegExp(escapeRegExp(pattern)) : pattern)
}

/** The string patterns of `build.transpile`, for `optimizeDeps.exclude`. */
export function getTranspileStrings (envs: Envs): string[] {
  return resolveTranspile(envs).filter(pattern => typeof pattern === 'string')
}
