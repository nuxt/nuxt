import { existsSync, readFileSync } from 'node:fs'
import ignore from 'ignore'
import { join, relative } from 'pathe'
import { tryUseNuxt } from './context'

/**
 * Return a filter function to filter an array of paths
 */
export function isIgnored (pathname: string): boolean {
  const nuxt = tryUseNuxt()

  // Happens with CLI reloads
  if (!nuxt) {
    return false
  }

  if (!nuxt._ignore) {
    nuxt._ignore = ignore(nuxt.options.ignoreOptions)
    nuxt._ignore.add(nuxt.options.ignore)

    const nuxtignoreFile = join(nuxt.options.rootDir, '.nuxtignore')
    if (existsSync(nuxtignoreFile)) {
      nuxt._ignore.add(readFileSync(nuxtignoreFile, 'utf-8'))
    }
  }

  const relativePath = relative(nuxt.options.rootDir, pathname)
  if (relativePath.startsWith('..')) {
    return false
  }
  return !!(relativePath && nuxt._ignore.ignores(relativePath))
}
