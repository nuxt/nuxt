import { existsSync, readFileSync } from 'node:fs'
import ignore from 'ignore'
import { join, relative, resolve } from 'pathe'
import { tryUseNuxt, useNuxt } from './context'

const cache = {
  '.nuxtignore': undefined as undefined | string[],
  ignorePaths: undefined as undefined | string,
  groupSyntax: {} as Record<string, string[]>
}

const checkIgnoreOutdated = (nuxt = useNuxt()) => cache.ignorePaths !== nuxt.options.ignore.join(',')

/**
 * Return a filter function to filter an array of paths
 */
export function isIgnored (pathname: string): boolean {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return false
  }

  if (!nuxt._ignore || checkIgnoreOutdated(nuxt)) {
    nuxt._ignore = ignore(nuxt.options.ignoreOptions)
    nuxt._ignore.add(resolveIgnorePatterns())
  }

  const cwds = nuxt.options._layers?.map(layer => layer.cwd).sort((a, b) => b.length - a.length)
  const layer = cwds?.find(cwd => pathname.startsWith(cwd))
  const relativePath = relative(layer ?? nuxt.options.rootDir, pathname)
  if (relativePath[0] === '.' && relativePath[1] === '.') {
    return false
  }
  return !!(relativePath && nuxt._ignore.ignores(relativePath))
}

export function resolveIgnorePatterns (relativePath?: string): string[] {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return []
  }

  if (!nuxt._ignorePatterns || checkIgnoreOutdated(nuxt)) {
    cache.ignorePaths = nuxt.options.ignore.join(',')
    nuxt._ignorePatterns = nuxt.options.ignore.flatMap(s => resolveGroupSyntax(s))

    if (cache['.nuxtignore']) {
      nuxt._ignorePatterns.push(...cache['.nuxtignore'])
    }

    const nuxtignoreFile = join(nuxt.options.rootDir, '.nuxtignore')
    if (!cache['.nuxtignore'] && existsSync(nuxtignoreFile)) {
      const contents = readFileSync(nuxtignoreFile, 'utf-8')
      const contentsArr = contents.trim().split(/\r?\n/)

      cache['.nuxtignore'] = contentsArr
      nuxt._ignorePatterns.push(...contentsArr)
    }
  }

  if (relativePath) {
    // Map ignore patterns based on if they start with * or !*
    return nuxt._ignorePatterns.map(p => p[0] === '*' || (p[0] === '!' && p[1] === '*') ? p : relative(relativePath, resolve(nuxt.options.rootDir, p)))
  }

  return nuxt._ignorePatterns
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
      if (cache.groupSyntax[group]) {
        return cache.groupSyntax[group]
      }

      const [head, ...tail] = group.split('{')
      if (tail.length) {
        const [body, ...rest] = tail.join('{').split('}')
        const resolvedGroup = body.split(',').map(part => `${head}${part}${rest.join('')}`)
        cache.groupSyntax[group] = resolvedGroup

        return resolvedGroup
      }

      return group
    })
  }
  return groups
}
