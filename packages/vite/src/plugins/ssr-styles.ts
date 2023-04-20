import { pathToFileURL } from 'node:url'
import type { Plugin } from 'vite'
import { findStaticImports } from 'mlly'
import { dirname, relative } from 'pathe'
import { genObjectFromRawEntries } from 'knitwork'
import { filename } from 'pathe/utils'
import { parseQuery, parseURL } from 'ufo'

interface SSRStylePluginOptions {
  srcDir: string
  chunksWithInlinedCSS: Set<string>
  shouldInline?: (id?: string) => boolean
}

export function ssrStylesPlugin (options: SSRStylePluginOptions): Plugin {
  const cssMap: Record<string, { files: string[], inBundle: boolean }> = {}
  const idRefMap: Record<string, string> = {}

  const relativeToSrcDir = (path: string) => relative(options.srcDir, path)

  const warnCache = new Set<string>()

  return {
    name: 'ssr-styles',
    resolveId: {
      order: 'pre',
      async handler (id, importer, options) {
        if (!id.endsWith('.vue')) { return }

        const res = await this.resolve(id, importer, { ...options, skipSelf: true })
        if (res) {
          return {
            ...res,
            moduleSideEffects: false
          }
        }
      }
    },
    generateBundle (outputOptions) {
      const emitted: Record<string, string> = {}
      for (const file in cssMap) {
        const { files, inBundle } = cssMap[file]
        // File has been tree-shaken out of build (or there are no styles to inline)
        if (!files.length || !inBundle) { continue }

        const base = typeof outputOptions.assetFileNames === 'string'
          ? outputOptions.assetFileNames
          : outputOptions.assetFileNames({
            type: 'asset',
            name: `${filename(file)}-styles.mjs`,
            source: ''
          })

        emitted[file] = this.emitFile({
          type: 'asset',
          name: `${filename(file)}-styles.mjs`,
          source: [
            ...files.map((css, i) => `import style_${i} from './${relative(dirname(base), this.getFileName(css))}';`),
            `export default [${files.map((_, i) => `style_${i}`).join(', ')}]`
          ].join('\n')
        })
      }

      for (const key in emitted) {
        // Track the chunks we are inlining CSS for so we can omit including links to the .css files
        options.chunksWithInlinedCSS.add(key)
      }

      this.emitFile({
        type: 'asset',
        fileName: 'styles.mjs',
        source:
          [
            'const interopDefault = r => r.default || r || []',
            `export default ${genObjectFromRawEntries(
              Object.entries(emitted).map(([key, value]) => [key, `() => import('./${this.getFileName(value)}').then(interopDefault)`]) as [string, string][]
            )}`
          ].join('\n')
      })
    },
    renderChunk (_code, chunk) {
      if (!chunk.facadeModuleId) { return null }
      const id = relativeToSrcDir(chunk.facadeModuleId)
      for (const file in chunk.modules) {
        const relativePath = relativeToSrcDir(file)
        if (relativePath in cssMap) {
          cssMap[relativePath].inBundle = cssMap[relativePath].inBundle ?? !!id
        }
      }

      return null
    },
    async transform (code, id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)
      if (!pathname.match(/\.(vue|((c|m)?j|t)sx?)$/g) || query.macro) { return }
      if (options.shouldInline && !options.shouldInline(id)) { return }

      const relativeId = relativeToSrcDir(id)
      cssMap[relativeId] = cssMap[relativeId] || { files: [] }

      let styleCtr = 0
      for (const i of findStaticImports(code)) {
        const { type } = parseQuery(i.specifier)
        if (type !== 'style' && !i.specifier.endsWith('.css')) { continue }

        const resolved = await this.resolve(i.specifier, id)
        if (!resolved) { continue }
        if (!(await this.resolve(resolved.id + '?inline&used'))) {
          if (!warnCache.has(resolved.id)) {
            warnCache.add(resolved.id)
            this.warn(`[nuxt] Cannot extract styles for \`${i.specifier}\`. Its styles will not be inlined when server-rendering.`)
          }
          continue
        }

        const ref = this.emitFile({
          type: 'chunk',
          name: `${filename(id)}-styles-${++styleCtr}.mjs`,
          id: resolved.id + '?inline&used'
        })

        idRefMap[relativeToSrcDir(resolved.id)] = ref
        cssMap[relativeId].files.push(ref)
      }
    }
  }
}
