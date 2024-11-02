import { relative, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { NuxtOptions } from 'nuxt/schema'

interface ImportProtectionOptions {
  rootDir: string
  modulesDir: string[]
  patterns: [importPattern: string | RegExp, warning?: string][]
  exclude?: Array<RegExp | string>
}

interface NuxtImportProtectionOptions {
  context: 'nuxt-app' | 'nitro-app' | 'shared'
}

export const createImportProtectionPatterns = (nuxt: { options: NuxtOptions }, options: NuxtImportProtectionOptions) => {
  const patterns: ImportProtectionOptions['patterns'] = []
  const context = contextFlags[options.context]

  patterns.push([
    /^(nuxt|nuxt3|nuxt-nightly)$/,
    `\`nuxt\`, or \`nuxt-nightly\` cannot be imported directly in ${context}.` + (options.context === 'nuxt-app' ? ' Instead, import runtime Nuxt composables from `#app` or `#imports`.' : ''),
  ])

  patterns.push([
    /^((~|~~|@|@@)?\/)?nuxt\.config(\.|$)/,
    'Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module.',
  ])

  patterns.push([/(^|node_modules\/)@vue\/composition-api/])

  for (const mod of nuxt.options.modules.filter(m => typeof m === 'string')) {
    patterns.push([
      new RegExp(`^${escapeRE(mod)}$`),
      'Importing directly from module entry-points is not allowed.',
    ])
  }

  for (const i of [/(^|node_modules\/)@nuxt\/(kit|test-utils)/, /(^|node_modules\/)nuxi/, /(^|node_modules\/)nitro(?:pack)?(?:-nightly)?(?:$|\/)(?!(?:dist\/)?runtime|types)/, /(^|node_modules\/)nuxt\/(config|kit|schema)/]) {
    patterns.push([i, `This module cannot be imported in ${context}.`])
  }

  if (options.context === 'nitro-app' || options.context === 'shared') {
    for (const i of ['#app', /^#build(\/|$)/]) {
      patterns.push([i, `Vue app aliases are not allowed in ${context}.`])
    }
  }

  if (options.context === 'nuxt-app' || options.context === 'shared') {
    patterns.push([
      new RegExp(escapeRE(relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server'))) + '\\/(api|routes|middleware|plugins)\\/'),
      `Importing from server is not allowed in ${context}.`,
    ])
  }

  return patterns
}

const contextFlags = {
  'nitro-app': 'server runtime',
  'nuxt-app': 'the Vue part of your app',
  'shared': 'the #shared directory',
} as const
