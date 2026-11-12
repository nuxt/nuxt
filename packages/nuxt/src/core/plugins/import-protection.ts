import { join, relative, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
import { ImpoundPlugin } from 'impound'
import { withTrailingSlash } from 'ufo'
import { addBuildPlugin, addVitePlugin } from '@nuxt/kit'
import type { Nuxt, NuxtOptions } from 'nuxt/schema'

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
    /(^|node_modules\/)@nuxt\/(kit|test-utils)/,
    /(^|node_modules\/)@nuxt\/cli(?:-nightly)?(?:$|\/)(?!runtime\/)/,
    /(^|node_modules\/)nuxi/,
    /(^|node_modules\/)nitropack(?:-nightly)?(?:$|\/)(?!(?:dist\/)?(?:node_modules|presets|runtime|types))/,
    /(^|node_modules\/)nitro(?:-nightly)?\/(builder|meta|vite(?!\/runtime(?:$|\/))|tsconfig)/,
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
  }

  if (options.context === 'nuxt-app' || options.context === 'shared') {
    const serverRelative = escapeRE(relative(nuxt.options.rootDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server')))
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
    // denied by the build, not by its types: those resolve in every context, which is what
    // lets the generated server-route typings type `$fetch`
    patterns.push([
      /^nuxt\/(?:server|internal\/server-app-config)$/,
      `\`nuxt/server\` cannot be imported in ${context}.`,
      ['Import runtime Nuxt composables from `#app` or `#imports` instead.', 'Use `$fetch()` or `useFetch()` to call server endpoints.'],
    ])
  }

  return patterns
}

/**
 * Deny imports that cannot work in the Vue app (and, more strictly, in the `shared/` directory).
 */
export function addImportProtectionPlugins (nuxt: Nuxt) {
  const sharedDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared))
  const relativeSharedDir = withTrailingSlash(relative(nuxt.options.rootDir, resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))
  const sharedPatterns = [/^#shared\//, new RegExp('^' + escapeRE(sharedDir)), new RegExp('^' + escapeRE(relativeSharedDir))]
  const trace = nuxt.options.dev ? true : 'lazy' as const
  const sharedMatcher = {
    include: sharedPatterns,
    patterns: createImportProtectionPatterns(nuxt, { context: 'shared' }),
  }
  const nuxtAppMatcher = {
    // Exclude top-level resolutions by plugins
    exclude: [relative(nuxt.options.rootDir, join(nuxt.options.srcDir, 'index.html')), ...sharedPatterns],
    patterns: createImportProtectionPatterns(nuxt, { context: 'nuxt-app' }),
  }
  addBuildPlugin({
    webpack: () => ImpoundPlugin.webpack({ cwd: nuxt.options.rootDir, trace, ...sharedMatcher }),
    rspack: () => ImpoundPlugin.rspack({ cwd: nuxt.options.rootDir, trace, ...sharedMatcher }),
  }, { server: false, prepend: true })

  addBuildPlugin({
    webpack: () => ImpoundPlugin.webpack({ cwd: nuxt.options.rootDir, trace, ...nuxtAppMatcher }),
    rspack: () => ImpoundPlugin.rspack({ cwd: nuxt.options.rootDir, trace, ...nuxtAppMatcher }),
  })

  // In Vite the main impound plugin (resolveId) is prepended to run before Vite's resolver, while
  // the trace plugin (transform) runs after SFC compilation so es-module-lexer can parse the
  // compiled JS. Both matchers share a single plugin instance so eager tracing parses each module once.
  for (const envOptions of [{ client: false }, { server: false }] as const) {
    const error = envOptions.client !== false
    const matcherOptions = { error, ...(!error && { warn: 'once' as const }) }
    const matchers = error
      ? [{ ...sharedMatcher, ...matcherOptions }, { ...nuxtAppMatcher, ...matcherOptions }]
      : [{ ...nuxtAppMatcher, ...matcherOptions }]
    const vitePlugins = [ImpoundPlugin.vite({ cwd: nuxt.options.rootDir, trace, matchers })].flat()
      .map(p => Object.assign(p, { name: `nuxt:import-protection:${p.name}` }))
    const mainPlugins = vitePlugins.filter(p => !p.name.includes('trace'))
    const tracePlugins = vitePlugins.filter(p => p.name.includes('trace'))
    if (mainPlugins.length) {
      addVitePlugin(() => mainPlugins, { ...envOptions, prepend: true })
    }
    if (tracePlugins.length) {
      addVitePlugin(() => tracePlugins, envOptions)
    }
  }
}

const contextFlags = {
  'nitro-app': 'server runtime',
  'nuxt-app': 'the Vue part of your app',
  'shared': 'the #shared directory',
} as const
