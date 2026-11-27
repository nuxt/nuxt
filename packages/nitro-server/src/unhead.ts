import { join } from 'pathe'

const UNHEAD_IMPORT_RE = /^unhead(?:\/|$)/

/**
 * Resolve every import of `unhead` and its subpaths from `appDir`, so that server code uses the
 * copy of `unhead` the Nuxt runtime renders with, even when another copy is closer to the importer.
 */
export function unheadDedupePlugin (appDir: string) {
  const nuxtImporter = join(appDir, 'index.js')
  return {
    name: 'nuxt:unhead:dedupe',
    resolveId: {
      order: 'pre' as const,
      filter: { id: UNHEAD_IMPORT_RE },
      handler (this: PluginContext, id: string, importer: string | undefined, options: Record<string, unknown>) {
        if (!importer) {
          return
        }
        return this.resolve(id, nuxtImporter, { ...options, skipSelf: true })
      },
    },
  }
}

interface PluginContext {
  resolve: (id: string, importer?: string, options?: Record<string, unknown>) => Promise<{ id: string } | null>
}
