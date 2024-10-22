import { relative, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { NuxtOptions } from 'nuxt/schema'

interface ImportProtectionOptions {
  rootDir: string
  modulesDir: string[]
  patterns: [importPattern: string | RegExp, warning?: string][]
  exclude?: Array<RegExp | string>
}

export const nuxtImportProtections = (nuxt: { options: NuxtOptions }, options: { isNitro?: boolean } = {}) => {
  const string_modules = nuxt.options.modules.filter(m => typeof m === 'string')
  const other_pkgs = [/(^|node_modules\/)@nuxt\/(kit|test-utils)/, /(^|node_modules\/)nuxi/, /(^|node_modules\/)nitro(?:pack)?(?:-nightly)?(?:$|\/)(?!(?:dist\/)?runtime|types)/, /(^|node_modules\/)nuxt\/(config|kit|schema)/]
  const patterns: ImportProtectionOptions['patterns'] = new Array(4 + string_modules.length + other_pkgs.length)
  patterns[0] = [
    /^(nuxt|nuxt3|nuxt-nightly)$/,
    '`nuxt`, `nuxt3` or `nuxt-nightly` cannot be imported directly.' + (options.isNitro ? '' : ' Instead, import runtime Nuxt composables from `#app` or `#imports`.'),
  ]

  patterns[1] = [
    /^((~|~~|@|@@)?\/)?nuxt\.config(\.|$)/,
    'Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module.',
  ]

  patterns[2] = [/(^|node_modules\/)@vue\/composition-api/]
  let count = 3
  for (const mod of string_modules) {
    patterns[count++] = [
      new RegExp(`^${escapeRE(mod as string)}$`),
      'Importing directly from module entry-points is not allowed.',
    ]
  }

  for (const i of other_pkgs) {
    patterns[count++] = [i, 'This module cannot be imported' + (options.isNitro ? ' in server runtime.' : ' in the Vue part of your app.')]
  }

  if (options.isNitro) {
    patterns[count++] = ['#app', 'Vue app aliases are not allowed in server runtime.']
    patterns.push([/^#build(\/|$)/, 'Vue app aliases are not allowed in server runtime.'])
  }

  if (!options.isNitro) {
    patterns[count++] = [
      new RegExp(escapeRE(relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server'))) + '\\/(api|routes|middleware|plugins)\\/'),
      'Importing from server is not allowed in the Vue part of your app.',
    ]
  }

  return patterns
}
