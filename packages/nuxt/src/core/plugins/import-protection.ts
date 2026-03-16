import { isAbsolute, relative, resolve } from 'pathe'
import { withTrailingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { resolveAlias } from '@nuxt/kit'
import type { NuxtOptions } from 'nuxt/schema'

type ImportPattern = [importPattern: string | RegExp | ((id: string, importer: string) => boolean | string), warning?: string, suggestions?: string[]]

interface ImportProtectionOptions {
  rootDir: string
  modulesDir: string[]
  patterns: ImportPattern[]
  exclude?: Array<RegExp | string>
}

interface NuxtImportProtectionOptions {
  context: 'nuxt-app' | 'nitro-app' | 'shared'
}

/**
 * Shared exclusions for import protection. Used by createResolvedPathBlocker and nitro-server
 * ImpoundPlugin config so allowed imports stay in sync.
 */
export const IMPORT_PROTECTION_ALLOWED = {
  /** Matches srvx (bare, srvx/, srvx/...) for excludeFiles. */
  srvxPattern: /srvx(\/|$)/,
  /** Returns true if id is allowed (srvx, node_modules, .nuxt/dist). */
  isAllowed (id: string, normalized?: string): boolean {
    if (id === 'srvx' || id.startsWith('srvx/') || id.includes('/srvx/')) {
      return true
    }
    const pathToCheck = normalized ?? id
    return pathToCheck.includes('node_modules') || pathToCheck.includes('.nuxt/dist/')
  },
}

/**
 * Returns a pattern that blocks imports whose resolved path is under the given directory.
 * normalized !== dir excludes the directory itself (e.g. /root/src/), only nested paths are blocked.
 * @param excludeDir - When provided, paths under this directory are not blocked (e.g. serverDir in nitro-app).
 */
function isSubpath (parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith('/')
}

function createResolvedPathBlocker (
  rootDir: string,
  dir: string,
  message: string,
  excludeDir?: string,
): (id: string) => false | string {
  const dirNorm = withTrailingSlash(resolve(dir))
  const excludeDirNorm = excludeDir ? withTrailingSlash(resolve(excludeDir)) : ''
  return (id: string) => {
    if (IMPORT_PROTECTION_ALLOWED.isAllowed(id)) {
      return false
    }
    const absolute = isAbsolute(id) ? id : resolve(rootDir, id)
    const normalized = resolve(absolute)
    if (IMPORT_PROTECTION_ALLOWED.isAllowed(id, normalized)) {
      return false
    }
    if (excludeDirNorm && isSubpath(excludeDirNorm, normalized)) {
      return false
    }
    return isSubpath(dirNorm, normalized) ? message : false
  }
}

export function createImportProtectionPatterns (nuxt: { options: NuxtOptions }, options: NuxtImportProtectionOptions) {
  const patterns: ImportProtectionOptions['patterns'] = []
  const context = contextFlags[options.context]

  patterns.push([
    /^(nuxt|nuxt3|nuxt-nightly)$/,
    `\`nuxt\` or \`nuxt-nightly\` cannot be imported directly in ${context}.`,
    options.context === 'nuxt-app'
      ? ['Import runtime Nuxt composables from `#app` or `#imports` instead.']
      : ['Use `#app` or `#imports` for runtime composables in your Vue app code.'],
  ])

  patterns.push([
    /^((~|~~|@|@@)?\/)?nuxt\.config(\.|$)/,
    'Importing directly from a `nuxt.config` file is not allowed.',
    ['Use `useRuntimeConfig()` to access runtime config in your app.', 'Use `useAppConfig()` to access config that doesn\'t need to be changed at runtime.', 'Use a Nuxt module to access build-time configuration.'],
  ])

  patterns.push([/(^|node_modules\/)@vue\/composition-api/])

  for (const mod of nuxt.options._installedModules) {
    if (mod.entryPath) {
      patterns.push([
        new RegExp(`^${escapeRE(mod.entryPath)}$`),
        'Importing directly from module entry-points is not allowed.',
        ['Import from the module\'s runtime directory instead (e.g. `my-module/runtime/...`).'],
      ])
    }
  }

  for (const i of [
    /(^|node_modules\/)@nuxt\/(cli|kit|test-utils)/,
    /(^|node_modules\/)nuxi/,
    /(^|node_modules\/)nitropack(?:-nightly)?(?:$|\/)(?!(?:dist\/)?(?:node_modules|presets|runtime|types))/,
    /(^|node_modules\/)nitro(?:-nightly)?\/(builder|meta|vite|tsconfig)/,
    /(^|node_modules\/)nuxt\/(config|kit|schema)/,
  ]) {
    patterns.push([
      i,
      `This module cannot be imported in ${context}.`,
      ['These are build-time only packages and cannot be used at runtime.'],
    ])
  }

  if (options.context === 'nitro-app' || options.context === 'shared') {
    for (const i of ['#app', /^#build(\/|$)/]) {
      patterns.push([
        i,
        `Vue app aliases are not allowed in ${context}.`,
        ['Move this code to your Vue app directory or use a shared utility.'],
      ])
    }
    // App directory aliases ~ and @ (resolve to srcDir). Exclude ~/serverDir/ and @/serverDir/ so
    // nitro-app can import from serverDir. Order matters: these run before createResolvedPathBlocker.
    const srcDirResolved = resolve(nuxt.options.rootDir, nuxt.options.srcDir)
    const serverDirPath = resolve(srcDirResolved, nuxt.options.serverDir || 'server')
    const serverDirRelative = relative(srcDirResolved, serverDirPath) || 'server'
    const escapedServerDir = escapeRE(serverDirRelative.replace(/[/\\]+$/, ''))
    patterns.push([
      new RegExp(`^~\\/(?!${escapedServerDir}\\/)`),
      `Vue app aliases are not allowed in ${context}.`,
      ['Move this code to your Vue app directory or use a shared utility.'],
    ])
    patterns.push([
      new RegExp(`^@\\/(?!${escapedServerDir}\\/)`),
      `Vue app aliases are not allowed in ${context}.`,
      ['Move this code to your Vue app directory or use a shared utility.'],
    ])
    // Resolve aliases (~~, @@, or custom) and block when resolved path is under srcDir (app) but not serverDir.
    const rootDir = withTrailingSlash(nuxt.options.rootDir)
    const srcDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.srcDir))
    const serverDir = withTrailingSlash(resolve(nuxt.options.rootDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server')))
    const alias = nuxt.options.alias || {}
    patterns.push([
      /**
       * resolved === id means no alias matched; such imports (e.g. ./foo, ../bar) are
       * checked by createResolvedPathBlocker, so we return false here.
       */
      (id: string, _importer: string) => {
        const resolved = resolveAlias(id, alias)
        if (!resolved || resolved === id) {
          return false
        }
        const absolute = isAbsolute(resolved) ? resolved : resolve(rootDir, resolved)
        const normalized = resolve(absolute)
        const relToServer = relative(serverDir, normalized)
        const relToSrc = relative(srcDir, normalized)
        const isInsideServer = relToServer !== '' && !relToServer.startsWith('..') && !relToServer.startsWith('/')
        const isInsideSrc = relToSrc !== '' && !relToSrc.startsWith('..') && !relToSrc.startsWith('/')
        if (isInsideServer) {
          return false
        }
        return isInsideSrc
          ? `Vue app aliases are not allowed in ${context}.`
          : false
      },
      `Vue app aliases are not allowed in ${context}.`,
      ['Move this code to your Vue app directory or use a shared utility.'],
    ])
    // Resolved paths (e.g. from relative imports). ImpoundPlugin resolves relative to importer,
    // then normalizes to cwd; we use rootDir as the unified base for the startsWith check.
    const appBlockMessage = `Vue app aliases are not allowed in ${context}.`
    patterns.push([
      createResolvedPathBlocker(nuxt.options.rootDir, srcDir, appBlockMessage, serverDir),
      appBlockMessage,
      ['Move this code to your Vue app directory or use a shared utility.'],
    ])
  }

  if (options.context === 'nuxt-app' || options.context === 'shared') {
    const serverDir = withTrailingSlash(resolve(nuxt.options.rootDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server')))
    const serverRelative = escapeRE(relative(nuxt.options.rootDir, serverDir))
    patterns.push([
      new RegExp('^' + serverRelative + '\\/(api|routes|middleware|plugins)\\/'),
      `Importing from server is not allowed in ${context}.`,
      ['Use `$fetch()` or `useFetch()` to fetch data from server routes.', 'Move shared logic to the `shared/` directory.'],
    ])
    patterns.push([
      /^#server(\/|$)/,
      `Server aliases are not allowed in ${context}.`,
      ['Use `$fetch()` or `useFetch()` to call server endpoints.', 'Move shared logic to the `shared/` directory.'],
    ])
    const alias = nuxt.options.alias || {}
    /**
     * Resolve aliases (e.g. custom module alias to server) and block when resolved path is under serverDir.
     * resolved === id means no alias matched; such imports are checked by createResolvedPathBlocker.
     */
    patterns.push([
      (id: string) => {
        const resolved = resolveAlias(id, alias)
        if (!resolved || resolved === id) {
          return false
        }
        const absolute = isAbsolute(resolved) ? resolved : resolve(nuxt.options.rootDir, resolved)
        const normalized = resolve(absolute)
        return isSubpath(serverDir, normalized)
          ? `Importing from server is not allowed in ${context}.`
          : false
      },
      `Importing from server is not allowed in ${context}.`,
      ['Use `$fetch()` or `useFetch()` to fetch data from server routes.', 'Move shared logic to the `shared/` directory.'],
    ])
    const serverBlockMessage = `Importing from server is not allowed in ${context}.`
    const serverSuggestions = ['Use `$fetch()` or `useFetch()` to fetch data from server routes.', 'Move shared logic to the `shared/` directory.']
    patterns.push([
      createResolvedPathBlocker(nuxt.options.rootDir, serverDir, serverBlockMessage),
      serverBlockMessage,
      serverSuggestions,
    ])
  }

  return patterns
}

const contextFlags = {
  'nitro-app': 'server runtime',
  'nuxt-app': 'the Vue part of your app',
  'shared': 'the #shared directory',
} as const
