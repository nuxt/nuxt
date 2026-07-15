import { relative, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
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
  }

  return patterns
}

const contextFlags = {
  'nitro-app': 'server runtime',
  'nuxt-app': 'the Vue part of your app',
  'shared': 'the #shared directory',
} as const
