import { readFileSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { basename, dirname, join, relative } from 'pathe'
import { bundlerDiagnostics, parseNodeModulePath, resolveVuePackageImporter, resolveVuePackages } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitropack/types'
import type { ModuleInfo, Plugin } from 'rollup'

import { toArray } from './utils.ts'

// resolved from their dependent so that a hoisted copy of another version is not bundled
const VUE_SPECIFIERS: Array<[specifier: string, dependent?: string]> = [
  ['vue'],
  ['vue/server-renderer'],
  ['vue/jsx-runtime'],
  ['vue/jsx-dev-runtime'],
  ['@vue/shared', 'vue'],
  ['@vue/runtime-dom', 'vue'],
  ['@vue/runtime-core', '@vue/runtime-dom'],
  ['@vue/reactivity', '@vue/runtime-core'],
  ['@vue/server-renderer', 'vue'],
]

const VUE_PACKAGE_RE = String.raw`(?:vue|@vue[\\/](?:shared|reactivity|runtime-core|runtime-dom|server-renderer))`
const VUE_PACKAGE_ID_RE = new RegExp(String.raw`^${VUE_PACKAGE_RE}$`)
const VUE_SPECIFIER_RE = new RegExp(String.raw`^${VUE_PACKAGE_RE}(?:/|$)`)
const VUE_MODULE_RE = new RegExp(String.raw`(?:^|[\\/])node_modules[\\/]${VUE_PACKAGE_RE}[\\/]`)
const IMPORT_META_STUB_RE = /^(?:import\s+(\w+)\s+from\s*["']node:process["'];?\s*globalThis\._importMeta_\s*=\s*\{\s*url:[^,]+,\s*env:\s*\1\.env\s*\}|globalThis\._importMeta_\s*=\s*\{\s*url:[^,]+,\s*env:\s*\{\s*\}\s*\});?\s*/
const IMPORT_META_RESET_RE = /globalThis\._importMeta_\s*=(?!\s*globalThis\._importMeta_)/
const SHEBANG_RE = /^#![^\n]*\n/
const PROVIDED_SUBPATH_RE = /^\.\/(?:package\.json|index\.m?js|dist\/[\w.-]+\.cjs(?:\.prod)?\.js|(?:server-renderer|jsx-runtime|jsx-dev-runtime)\/index\.m?js)$/
const VUE_CJS_REGISTER_FILE = 'chunks/_/vue-cjs.mjs'
const VUE_REGISTRY_SYMBOL = `Symbol.for('nuxt.vue')`

/**
 * Bundles the Vue runtime into a production server build that would otherwise trace Vue into
 * `node_modules`, and emits it as the `vue` and `@vue/*` packages in the output `node_modules`.
 * The app and any traced dependency importing or requiring Vue then share a single copy of its
 * ES module bundler build.
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

// rollup cannot render a module that was loaded with `this.load()` but never imported
function isInModuleGraph (info: ModuleInfo | null): boolean {
  return !!info && (info.isEntry || info.importers.length > 0 || info.dynamicImporters.length > 0 || info.implicitlyLoadedAfterOneOf.length > 0)
}

function toRelativeImport (fromFile: string, toFile: string): string {
  const rel = relative(dirname(fromFile), toFile)
  return rel.startsWith('.') ? rel : `./${rel}`
}

function createCjsShim (esmFile: string): string {
  const file = basename(esmFile)
  return `module.exports=globalThis[${VUE_REGISTRY_SYMBOL}]?.[require('node:url').pathToFileURL(require('node:path').join(__dirname,${JSON.stringify(file)})).href]??require(${JSON.stringify(`./${file}`)});\n`
}

function createCjsRegister (esmFiles: string[]): string {
  const imports = esmFiles.map((file, i) => `import * as m${i} from${JSON.stringify(toRelativeImport(VUE_CJS_REGISTER_FILE, file))};`).join('')
  const entries = esmFiles.map((file, i) => `[${JSON.stringify(toRelativeImport(VUE_CJS_REGISTER_FILE, file))},m${i}]`).join(',')
  return `${imports}const r=globalThis[${VUE_REGISTRY_SYMBOL}]||=Object.create(null),w=m=>{const e=Object.defineProperty({},'__esModule',{value:true});for(const k of Object.keys(m))Object.defineProperty(e,k,{enumerable:true,get:()=>m[k]});return e};for(const[p,m]of[${entries}])r[new URL(p,import.meta.url).href]=w(m);\n`
}

function VuePackagePlugin (nuxt: Nuxt, ignoredImports: Set<string>): Plugin {
  const packageFiles = new Set<string>()
  return {
    name: 'nuxt:vue-package',
    resolveId: {
      order: 'pre',
      filter: { id: VUE_PACKAGE_ID_RE },
      async handler (id, importer, options) {
        const pkg = await this.resolve(`${id}/package.json`, importer, { ...options, skipSelf: true })
        if (!pkg || pkg.external) { return }
        const build = id === 'vue' ? 'vue.runtime' : id.slice('@vue/'.length)
        return join(dirname(pkg.id), 'dist', `${build}.esm-bundler.js`)
      },
    },
    outputOptions (output) {
      const manualChunks = output.manualChunks
      if (manualChunks && typeof manualChunks !== 'function') {
        this.error('`manualChunks` must be a function to bundle Vue into the server build.')
      }
      return {
        ...output,
        manualChunks: (id, meta) => VUE_MODULE_RE.test(id) && isInModuleGraph(meta.getModuleInfo(id)) ? 'vue' : manualChunks?.(id, meta),
      }
    },
    async buildStart () {
      packageFiles.clear()
      const importer = resolveVuePackageImporter(resolveVuePackages(nuxt), 'vue') ?? join(nuxt.options.appDir, 'entry.js')
      const vue = await this.resolve('vue', importer, { skipSelf: false })
      if (!vue || vue.external) {
        this.error('Could not resolve `vue` to bundle it into the server build.')
      }
      const exports = new Map<string, Record<string, { import: string, require: string, default: string }>>()
      const versions = new Map<string, string>()
      const resolvedIds = new Map([['vue', vue.id]])
      const esmFiles: string[] = []
      for (const [specifier, dependent] of VUE_SPECIFIERS) {
        const from = dependent ? resolvedIds.get(dependent) : importer
        if (!from) { continue }
        const resolved = await this.resolve(specifier, from, { skipSelf: false })
        if (!resolved || resolved.external) { continue }
        resolvedIds.set(specifier, resolved.id)
        const pkg = specifier.startsWith('@vue/') ? specifier : 'vue'
        const subpath = specifier.slice(pkg.length)
        const base = subpath ? `.${subpath}` : './index'
        const esmFile = `${base}.mjs`
        const cjsFile = `${base}.cjs`
        const esmFileName = join('node_modules', pkg, esmFile)
        packageFiles.add(esmFileName)
        esmFiles.push(esmFileName)
        this.emitFile({ type: 'chunk', id: resolved.id, fileName: esmFileName, preserveSignature: 'strict' })
        this.emitFile({ type: 'asset', fileName: join('node_modules', pkg, cjsFile), source: createCjsShim(esmFile) })
        exports.set(pkg, { ...exports.get(pkg), [`.${subpath}`]: { import: esmFile, require: cjsFile, default: esmFile } })
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
            main: './index.cjs',
            exports: { ...pkgExports, './package.json': './package.json' },
          }),
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: VUE_CJS_REGISTER_FILE,
        source: createCjsRegister(esmFiles),
      })
    },
    renderChunk: {
      order: 'post',
      handler (code, chunk, options) {
        if (packageFiles.has(chunk.fileName)) {
          const match = IMPORT_META_STUB_RE.exec(code)
          if (match && !chunk.imports.includes('node:process')) {
            const rest = code.slice(match[0].length)
            if (!rest.includes('_importMeta_')) {
              return { code: rest, map: null }
            }
          }
          // nitro points `globalThis._importMeta_` at each entry chunk, and these load after the server entry
          return { code: code.replace(IMPORT_META_RESET_RE, '$&globalThis._importMeta_||'), map: null }
        }
        if (chunk.isEntry && options.format === 'es' && packageFiles.size > 0 && (chunk.imports.length > 0 || chunk.dynamicImports.length > 0)) {
          const registerImport = `import ${JSON.stringify(toRelativeImport(chunk.fileName, VUE_CJS_REGISTER_FILE))};`
          const shebang = SHEBANG_RE.exec(code)
          return {
            code: shebang ? shebang[0] + registerImport + code.slice(shebang[0].length) : registerImport + code,
            map: null,
          }
        }
      },
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
