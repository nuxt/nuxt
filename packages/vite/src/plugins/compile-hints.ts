import type { Nuxt, NuxtPage } from '@nuxt/schema'
import type { Plugin } from 'vite'

const COMPILE_HINT = '//# allFunctionsCalledOnLoad\n'
const INLINE_SOURCEMAP_RE = /\n\/\/# sourceMappingURL=data:application\/json[^\n]*\n?$/

/** @see https://v8.dev/blog/explicit-compile-hints */
export function CompileHintsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:compile-hints',
    enforce: 'post',
    apply: () => !nuxt.options.dev && nuxt.options.experimental.compileHints,
    applyToEnvironment: environment => environment.name === 'client',
    generateBundle: {
      order: 'post',
      handler (options, bundle) {
        const app = nuxt.apps.default
        const routeFiles = new Set<string>(Object.values(app?.layouts || {}).map(layout => layout.file))
        for (const page of flattenPages(app?.pages)) {
          if (page.file) { routeFiles.add(page.file) }
        }

        const queue: string[] = []
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') { continue }
          if (chunk.isEntry || (chunk.isDynamicEntry && chunk.facadeModuleId && routeFiles.has(chunk.facadeModuleId.split('?')[0]!))) {
            queue.push(chunk.fileName)
          }
        }

        const hinted = new Set<string>()
        while (queue.length) {
          const fileName = queue.pop()!
          const chunk = bundle[fileName]
          if (hinted.has(fileName) || chunk?.type !== 'chunk') { continue }
          hinted.add(fileName)
          queue.push(...chunk.imports)

          chunk.code = COMPILE_HINT + chunk.code
          if (!chunk.map) { continue }
          chunk.map.mappings = ';' + chunk.map.mappings
          if (options.sourcemap === 'inline') {
            chunk.code = chunk.code.replace(INLINE_SOURCEMAP_RE, '') + `\n//# sourceMappingURL=${chunk.map.toUrl()}`
            continue
          }
          const mapAsset = bundle[fileName + '.map']
          if (mapAsset?.type === 'asset') {
            mapAsset.source = chunk.map.toString()
          }
        }
      },
    },
  }
}

function flattenPages (pages: NuxtPage[] = []): NuxtPage[] {
  return pages.flatMap(page => [page, ...flattenPages(page.children)])
}
