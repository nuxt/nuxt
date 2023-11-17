import { existsSync, readFileSync } from 'node:fs'
import ignore from 'ignore'
import { join, relative, resolve } from 'pathe'
import { tryUseNuxt } from './context'

/**
 * Checks if pathname is ignored.
 * @param pathname - Pathname to check.
 * @returns `true` if ignored, `false` otherwise
 */
export function isIgnored(pathname: string): boolean {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return false
  }

  if (!nuxt._ignore) {
    // eslint-disable-next-line ts/no-unsafe-argument
    nuxt._ignore = ignore(nuxt.options.ignoreOptions)

    nuxt._ignore.add(resolveIgnorePatterns())
  }

  const cwds = nuxt.options._layers.map(
    (layer) => layer.cwd
  ).sort((a, b) => b.length - a.length)

  const layer = cwds.find((cwd) => pathname.startsWith(cwd))
  const relativePath = relative(layer ?? nuxt.options.rootDir, pathname)

  if (relativePath.startsWith('..')) {
    return false
  }

  return !!(relativePath && nuxt._ignore.ignores(relativePath))
}

/**
 * Resolve ignore patterns.
 * @param relativePath - Relative path.
 * @returns Ignore patterns
 */
export function resolveIgnorePatterns(relativePath?: string): string[] {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return []
  }

  if (!nuxt._ignorePatterns) {
    nuxt._ignorePatterns = nuxt.options.ignore.flatMap(
      (s) => resolveGroupSyntax(s)
    )

    const nuxtignoreFile = join(nuxt.options.rootDir, '.nuxtignore')

    if (existsSync(nuxtignoreFile)) {
      const contents = readFileSync(nuxtignoreFile, 'utf8')

      nuxt._ignorePatterns.push(...contents.trim().split(/\r?\n/))
    }
  }

  if (relativePath) {
    return nuxt._ignorePatterns.map(
      (p) => (
        p.startsWith('*') || p.startsWith('!*')
          ? p
          : relative(relativePath, resolve(nuxt.options.rootDir, p)))
    )
  }

  return nuxt._ignorePatterns
}

/**
 * Turns string containing groups '**\/*.{spec,test}.{js,ts}' into an array of strings. For example '**\/*.{spec,test}.{js,ts}' will be resolved to: ['**\/*.spec.js', '**\/*.spec.ts', '**\/*.test.js', '**\/*.test.ts'].
 * @param group - String containing the group syntax.
 * @returns Array of strings without the group syntax
 */
export function resolveGroupSyntax(group: string): string[] {
  let groups = [group]
  while (groups.some((group) => group.includes('{'))) {
    groups = groups.flatMap((group) => {
      const [head, ...tail] = group.split('{')

      if (tail.length > 0) {
        const [body, ...rest] = tail.join('{').split('}')

        return body.split(',').map((part) => `${head}${part}${rest.join('')}`)
      }

      return group
    })
  }
  return groups
}
