import type { Nuxt, NuxtPage } from '@nuxt/schema'
import type { Plugin } from 'vite'

const COMPILE_HINT = '//# allFunctionsCalledOnLoad\n'
const INLINE_SOURCEMAP_RE = /\n\/\/# sourceMappingURL=data:application\/json[^\n]*\n?$/

interface ChunkInfo {
  isEntry: boolean
  isDynamicEntry: boolean
  facadeModuleId: string | null
  imports: string[]
}

/** @see https://v8.dev/blog/explicit-compile-hints */
export function CompileHintsPlugin (nuxt: Nuxt): Plugin {
  let hintedChunks: Set<string> | undefined

  return {
    name: 'nuxt:compile-hints',
    enforce: 'post',
    apply: () => !nuxt.options.dev && nuxt.options.experimental.compileHints,
    applyToEnvironment: environment => environment.name === 'client',
    renderStart () {
      hintedChunks = undefined
    },
    renderChunk (_code, _chunk, _options, meta) {
      hintedChunks ||= collectHintedChunks(nuxt, meta.chunks)
    },
    augmentChunkHash (chunk) {
      if (hintedChunks?.has(chunk.fileName)) {
        return COMPILE_HINT
      }
    },
    generateBundle: {
      order: 'post',
      handler (options, bundle) {
        const chunks: Record<string, ChunkInfo> = {}
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk') { chunks[fileName] = chunk }
        }

        for (const fileName of collectHintedChunks(nuxt, chunks)) {
          const chunk = bundle[fileName]
          if (chunk?.type !== 'chunk') { continue }

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

function collectHintedChunks (nuxt: Nuxt, chunks: Record<string, ChunkInfo>) {
  const app = nuxt.apps.default
  const routeFiles = new Set<string>()
  for (const layout of Object.values(app?.layouts || {})) {
    routeFiles.add(withoutQuery(layout.file))
  }
  for (const page of flattenPages(app?.pages)) {
    if (page.file) { routeFiles.add(withoutQuery(page.file)) }
  }

  const queue: string[] = []
  for (const [fileName, chunk] of Object.entries(chunks)) {
    if (chunk.isEntry || (chunk.isDynamicEntry && chunk.facadeModuleId && routeFiles.has(withoutQuery(chunk.facadeModuleId)))) {
      queue.push(fileName)
    }
  }

  const hinted = new Set<string>()
  while (queue.length) {
    const fileName = queue.pop()!
    if (hinted.has(fileName) || !chunks[fileName]) { continue }
    hinted.add(fileName)
    queue.push(...chunks[fileName].imports)
  }
  return hinted
}

function withoutQuery (id: string) {
  return id.split('?')[0]!
}

function flattenPages (pages: NuxtPage[] = []): NuxtPage[] {
  return pages.flatMap(page => [page, ...flattenPages(page.children)])
}
