import { existsSync, readFileSync } from 'node:fs'
import ignore from 'ignore'
import { join, relative, resolve } from 'pathe'
import { tryUseNuxt } from './context.ts'
import { getLayerDirectories } from './layers.ts'
import type { Nuxt } from '@nuxt/schema'

export function createIsIgnored (nuxt: Nuxt | null | undefined = tryUseNuxt()): (pathname: string, stats?: unknown) => boolean {
  return (pathname, stats) => isIgnored(pathname, stats, nuxt)
}

// cache of layer root paths sorted by descending length per Nuxt instance.
const layerRootsCache = new WeakMap<Nuxt, string[]>()

/**
 * Return a filter function to filter an array of paths
 */
export function isIgnored (pathname: string, _stats?: unknown, nuxt: Nuxt | null | undefined = tryUseNuxt()): boolean {
  // Happens with CLI reloads
  if (!nuxt) {
    return false
  }

  if (!nuxt._ignore) {
    nuxt._ignore = ignore(nuxt.options.ignoreOptions)
    nuxt._ignore.add(resolveIgnorePatterns())
  }

  let cwds = layerRootsCache.get(nuxt)
  if (!cwds) {
    cwds = getLayerDirectories(nuxt)
      .map(dirs => dirs.root)
      .sort((a, b) => b.length - a.length)
    layerRootsCache.set(nuxt, cwds)
  }
  // layer roots are stored with a trailing slash, so when `pathname`
  // is below a layer root the relative path is exactly the suffix after
  // that prefix
  for (const cwd of cwds) {
    if (pathname.startsWith(cwd)) {
      const relativePath = pathname.slice(cwd.length)
      return !!(relativePath && nuxt._ignore.ignores(relativePath))
    }
  }
  const relativePath = relative(nuxt.options.rootDir, pathname)
  if (relativePath[0] === '.' && relativePath[1] === '.') {
    return false
  }
  return !!(relativePath && nuxt._ignore.ignores(relativePath))
}

const NEGATION_RE = /^(!?)(.*)$/

export function resolveIgnorePatterns (relativePath?: string): string[] {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return []
  }

  const ignorePatterns = nuxt.options.ignore.flatMap(s => resolveGroupSyntax(s))

  const nuxtignoreFile = join(nuxt.options.rootDir, '.nuxtignore')
  if (existsSync(nuxtignoreFile)) {
    const contents = readFileSync(nuxtignoreFile, 'utf-8')
    ignorePatterns.push(...contents.trim().split(/\r?\n/))
  }

  if (relativePath) {
    // Map ignore patterns based on if they start with * or !*
    return ignorePatterns.map((p) => {
      const [_, negation = '', pattern] = p.match(NEGATION_RE) || []
      if (pattern && pattern[0] === '*') {
        return p
      }
      return negation + relative(relativePath, resolve(nuxt.options.rootDir, pattern || p))
    })
  }

  return ignorePatterns
}

/**
 * This function turns string containing groups '**\/*.{spec,test}.{js,ts}' into an array of strings.
 * For example will '**\/*.{spec,test}.{js,ts}' be resolved to:
 * ['**\/*.spec.js', '**\/*.spec.ts', '**\/*.test.js', '**\/*.test.ts']
 * @param group string containing the group syntax
 * @returns {string[]} array of strings without the group syntax
 */
export function resolveGroupSyntax (group: string): string[] {
  let groups = [group]
  while (groups.some(group => group.includes('{'))) {
    groups = groups.flatMap((group) => {
      const [head, ...tail] = group.split('{')
      if (tail.length) {
        const [body = '', ...rest] = tail.join('{').split('}')
        return body.split(',').map(part => `${head}${part}${rest.join('')}`)
      }

      return group
    })
  }
  return groups
}
