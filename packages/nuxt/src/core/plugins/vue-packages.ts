import { dirname } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { VUE_PACKAGE_SPECIFIER_RE, isInVuePackages, resolveVuePackageImporter } from '@nuxt/kit/internal'
import type { VuePackages } from '@nuxt/kit/internal'
import type { Plugin } from 'vite'

/**
 * Resolves every import of a Vue runtime package to the single copy of Vue the app is built
 * with, wherever the importing file is. Used as both a Vite and a Rolldown plugin.
 */
export function VuePackagesPlugin (packages: VuePackages): Plugin {
  return {
    name: 'nuxt:vue-packages',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      filter: { id: VUE_PACKAGE_SPECIFIER_RE },
      async handler (id, importer, options) {
        if (importer && isInVuePackages(packages, importer)) {
          return
        }
        const pinnedImporter = resolveVuePackageImporter(packages, id)
        if (!pinnedImporter) {
          return
        }
        const resolved = await this.resolve(id, pinnedImporter, { ...options, skipSelf: true })
        if (!resolved || resolved.external || id === 'vue' || this.environment?.mode !== 'build' || this.environment.config.consumer !== 'server') {
          return resolved
        }
        // a server build that leaves `vue` external has to load the rest of Vue from outside it too
        const vue = await this.resolve('vue', resolveVuePackageImporter(packages, 'vue'), { skipSelf: true })
        const path = vue?.external && resolveModulePath(id, { from: pinnedImporter, conditions: ['node', 'import'], try: true })
        return path ? { id: path, external: 'absolute' } : resolved
      },
    },
  }
}

interface ResolveData {
  request: string
  context: string
  contextInfo: { issuer: string }
}

interface Compiler {
  hooks: {
    normalModuleFactory: {
      tap: (name: string, fn: (factory: { hooks: { beforeResolve: { tap: (name: string, fn: (data: ResolveData) => void) => void } } }) => void) => void
    }
  }
}

/**
 * Resolves every import of a Vue runtime package from the single copy of Vue the app is built
 * with, wherever the importing file is. Used as both a webpack and an Rspack plugin.
 */
export function VuePackagesBundlerPlugin (packages: VuePackages) {
  return {
    apply (compiler: Compiler) {
      compiler.hooks.normalModuleFactory.tap('nuxt:vue-packages', (factory) => {
        factory.hooks.beforeResolve.tap('nuxt:vue-packages', (data) => {
          if (!VUE_PACKAGE_SPECIFIER_RE.test(data.request) || (data.contextInfo.issuer && isInVuePackages(packages, data.contextInfo.issuer))) {
            return
          }
          const pinnedImporter = resolveVuePackageImporter(packages, data.request)
          if (pinnedImporter) {
            data.context = dirname(pinnedImporter)
          }
        })
      })
    },
  }
}
