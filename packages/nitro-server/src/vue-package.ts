import { readFileSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { join } from 'pathe'
import { bundlerDiagnostics, parseNodeModulePath } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitropack/types'
import type { Plugin } from 'rollup'

import { toArray } from './utils.ts'

const VUE_SPECIFIERS = [
  'vue',
  'vue/server-renderer',
  'vue/jsx-runtime',
  'vue/jsx-dev-runtime',
  '@vue/shared',
  '@vue/reactivity',
  '@vue/runtime-core',
  '@vue/runtime-dom',
  '@vue/server-renderer',
]

const VUE_PACKAGE_RE = String.raw`(?:vue|@vue[\\/](?:shared|reactivity|runtime-core|runtime-dom|server-renderer))`
const VUE_SPECIFIER_RE = new RegExp(String.raw`^${VUE_PACKAGE_RE}(?:/|$)`)
const VUE_MODULE_RE = new RegExp(String.raw`(?:^|[\\/])node_modules[\\/]${VUE_PACKAGE_RE}[\\/]`)
const PROVIDED_SUBPATH_RE = /^\.\/(?:package\.json|index\.m?js|dist\/[\w.-]+\.cjs(?:\.prod)?\.js|(?:server-renderer|jsx-runtime|jsx-dev-runtime)\/index\.m?js)$/

/**
 * Bundles the Vue runtime into a production server build that would otherwise trace Vue into
 * `node_modules`, and emits it as the `vue` and `@vue/*` packages in the output `node_modules`.
 * The app and any traced dependency importing Vue then share a single copy of its ES module
 * bundler build.
 */
export function setupVuePackage (nuxt: Nuxt, nitro: Nitro): void {
  if (
    nuxt.options.dev ||
    nuxt.options.vue.runtimeCompiler ||
    !nuxt.options.experimental.externalVue ||
    nitro.options.node === false ||
    nitro.options.noExternals ||
    nitro.options.inlineDynamicImports ||
    nitro.options.externals.trace === false
  ) {
    return
  }

  nitro.options.externals.inline = [
    ...nitro.options.externals.inline || [],
    (id: string) => VUE_SPECIFIER_RE.test(id) || VUE_MODULE_RE.test(id),
  ]

  const ignoredImports = new Set<string>()
  const traceOptions = nitro.options.externals.traceOptions ||= {}
  const ignore = traceOptions.ignore
  traceOptions.ignore = (path: string) => {
    if (VUE_MODULE_RE.test(path)) {
      ignoredImports.add(path)
      return true
    }
    if (typeof ignore === 'function') { return ignore(path) }
    return !!ignore && toArray(ignore).some(pattern => matchesGlob(path, pattern))
  }

  nitro.options.rollupConfig!.plugins = [...toArray(nitro.options.rollupConfig!.plugins || []), VuePackagePlugin(nuxt, ignoredImports)]
}

function VuePackagePlugin (nuxt: Nuxt, ignoredImports: Set<string>): Plugin {
  return {
    name: 'nuxt:vue-package',
    outputOptions (output) {
      const manualChunks = output.manualChunks
      if (manualChunks && typeof manualChunks !== 'function') {
        this.error('`manualChunks` must be a function to bundle Vue into the server build.')
      }
      return {
        ...output,
        manualChunks: (id, meta) => VUE_MODULE_RE.test(id) ? 'vue' : manualChunks?.(id, meta),
      }
    },
    async buildStart () {
      const importer = join(nuxt.options.appDir, 'entry.js')
      const vue = await this.resolve('vue', importer)
      if (!vue || vue.external) {
        this.error('Could not resolve `vue` to bundle it into the server build.')
      }
      const exports = new Map<string, Record<string, string>>()
      const versions = new Map<string, string>()
      for (const specifier of VUE_SPECIFIERS) {
        const resolved = await this.resolve(specifier, specifier.startsWith('@vue/') ? vue.id : importer)
        if (!resolved || resolved.external) { continue }
        const pkg = specifier.startsWith('@vue/') ? specifier : 'vue'
        const subpath = specifier.slice(pkg.length)
        const file = subpath ? `.${subpath}.mjs` : './index.mjs'
        this.emitFile({ type: 'chunk', id: resolved.id, fileName: join('node_modules', pkg, file), preserveSignature: 'strict' })
        exports.set(pkg, { ...exports.get(pkg), [`.${subpath}`]: file })
        if (!versions.has(pkg)) {
          const { dir, name } = parseNodeModulePath(resolved.id)
          versions.set(pkg, JSON.parse(readFileSync(join(dir!, name!, 'package.json'), 'utf8')).version)
        }
      }
      for (const [pkg, pkgExports] of exports) {
        this.emitFile({
          type: 'asset',
          fileName: join('node_modules', pkg, 'package.json'),
          source: JSON.stringify({
            name: pkg,
            version: versions.get(pkg),
            type: 'module',
            main: './index.mjs',
            exports: { ...pkgExports, './package.json': './package.json' },
          }, null, 2),
        })
      }
    },
    writeBundle () {
      const unsupported = new Set<string>()
      for (const path of ignoredImports) {
        const { name, subpath } = parseNodeModulePath('/' + path)
        if (!subpath || !PROVIDED_SUBPATH_RE.test(subpath)) {
          unsupported.add(`\`${name}/${subpath?.slice(2)}\``)
        }
      }
      if (unsupported.size) {
        bundlerDiagnostics.NUXT_B7028({ imports: [...unsupported].join(', ') })
      }
    },
  }
}
