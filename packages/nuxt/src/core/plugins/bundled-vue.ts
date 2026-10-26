import { isAbsolute } from 'pathe'
import { parseNodeModulePath } from '@nuxt/kit/internal'
import type { Plugin } from 'vite'

const VUE_PACKAGES = new Set(['vue', '@vue/server-renderer', '@vue/runtime-dom', '@vue/runtime-core', '@vue/reactivity', '@vue/shared'])
const VUE_PACKAGE_RE = String.raw`(?:vue|@vue[\\/](?:server-renderer|runtime-dom|runtime-core|reactivity|shared))`
const VUE_ID_RE = new RegExp(String.raw`^${VUE_PACKAGE_RE}(?:[\\/]|$)|[\\/]node_modules[\\/]${VUE_PACKAGE_RE}[\\/]`)
const CJS_ENTRY_RE = /^\.\/(?:index\.m?js|dist\/[\w-]+\.cjs(?:\.prod)?\.js)$/

/**
 * Resolves Vue and its `@vue/*` packages to their ES module bundler builds in server bundles
 * that inline Vue. Used as both a Vite and a Rolldown plugin.
 *
 * The `node` export condition resolves to CommonJS builds, which are wrapped in interop helpers
 * when bundled and do not apply the Vue feature flags. Ids are matched by their resolved path,
 * so bare and absolute imports of the same package share a single build. The bundle must
 * replace `process.env.NODE_ENV` and the `__VUE_*` feature flags.
 */
export function BundledVuePlugin (): Plugin {
  return {
    name: 'nuxt:bundled-vue',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      filter: { id: VUE_ID_RE },
      async handler (id, importer, options) {
        const resolveOptions = { ...options, skipSelf: true }
        if (isAbsolute(id)) {
          return toBundlerBuild(id)
        }
        if (VUE_PACKAGES.has(id)) {
          const pkg = await this.resolve(`${id}/package.json`, importer, resolveOptions)
          if (pkg && !pkg.external) {
            return toBundlerBuild(pkg.id.replace(/package\.json$/, 'index.js'))
          }
        }
        const resolved = await this.resolve(id, importer, resolveOptions)
        if (!resolved || resolved.external) { return resolved }
        return { ...resolved, id: toBundlerBuild(resolved.id) ?? resolved.id }
      },
    },
  }
}

function toBundlerBuild (id: string): string | undefined {
  const { dir, name, subpath } = parseNodeModulePath(id)
  if (!dir || !name || !subpath || !VUE_PACKAGES.has(name) || !CJS_ENTRY_RE.test(subpath)) { return }
  const build = name === 'vue' ? 'vue.runtime' : name.slice('@vue/'.length)
  return `${dir}${name}/dist/${build}.esm-bundler.js`
}
