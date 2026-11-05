import type { Plugin, ResolvedConfig, Rollup } from 'vite'
import { normalize } from 'pathe'
import { type ScanSfcOptions, type ScannedImport, scanClientTargets, scanSfcSource } from './scan.ts'
import type { IslandsV2Registry } from './manifest.ts'
import { toChunkRef } from './compiler/paths.ts'

export interface IslandsV2ScanPluginOptions {
  registry: IslandsV2Registry
  /**
   * SFCs scanned at build start, across every Nuxt layer.
   */
  collectFiles: () => Promise<Iterable<string>>
  /**
   * Components the SFC doesn't import statically, such as auto-imports, by PascalCase name.
   */
  additionalImports: () => ReadonlyMap<string, ScannedImport>
}

/**
 * `buildStart` pre-pass scanning SFC templates for `v-load-client` targets,
 * so the client manifest and the template transform see them before any environment builds.
 * In dev, each transformed SFC is scanned again to pick up new targets.
 */
export function islandsV2ScanPlugin (options: IslandsV2ScanPluginOptions): Plugin {
  const { additionalImports, collectFiles, registry } = options
  let config: ResolvedConfig
  let scanPromise: Promise<void> | undefined
  // Dev scans a file again on transform; its warnings already surfaced at buildStart.
  const warned = new Set<string>()

  const scanOptions = (ctx: Rollup.PluginContext, scanned: IslandsV2Registry['components']): ScanSfcOptions => ({
    root: config.root,
    additionalImports: additionalImports(),
    resolveImport: async (source, importer) => (await ctx.resolve(source, importer, { skipSelf: true }))?.id,
    registerTarget (sfcFile, tag, target) {
      const chunk = toChunkRef(target.path, config.root)
      let tags = scanned.get(sfcFile)
      if (!tags) { scanned.set(sfcFile, tags = new Map()) }
      tags.set(tag, { chunk, exportName: target.export })
      if (registry.targets.get(target.path) === chunk) { return }
      registry.targets.set(target.path, chunk)
      registry.invalidate?.()
    },
    warn (message) {
      if (warned.has(message)) { return }
      warned.add(message)
      ctx.warn(message)
    },
  })

  return {
    name: 'nuxt:islands-v2-scan',
    enforce: 'pre',
    configResolved (resolvedConfig) {
      config = resolvedConfig
    },
    async buildStart () {
      scanPromise ??= collectFiles().then(async (files) => {
        const scanned: IslandsV2Registry['components'] = new Map()
        await scanClientTargets(files, scanOptions(this, scanned))
        for (const [file, tags] of scanned) { registry.components.set(file, tags) }
      })
      await scanPromise
    },
    async transform (code, id) {
      if (config.command !== 'serve' || id.includes('?') || !id.endsWith('.vue')) { return }
      const file = normalize(id)
      const scanned: IslandsV2Registry['components'] = new Map()
      await scanSfcSource(code, id, scanOptions(this, scanned))
      registry.components.set(file, scanned.get(file) ?? new Map())
    },
  }
}
