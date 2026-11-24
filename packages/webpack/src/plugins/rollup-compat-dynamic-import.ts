import { genObjectFromRawEntries, genString } from 'knitwork'
import type { Compilation, Compiler, WebpackPluginInstance } from 'webpack'
import { isJS } from './vue/util.ts'

const DYNAMIC_IMPORT_RE = /import\([^)]*\+\s*__webpack_require__[^+]*\)\.then/
const DYNAMIC_IMPORT_REPLACE_RE = /import\([^)]*\+\s*(__webpack_require__[^+]*)\)\.then/g
const HELPER_FILENAME = '_dynamic-import-helper.mjs'
const HELPER_IMPORT = `import { _rollupDynamicImport } from "./${HELPER_FILENAME}";\n`

/**
 * Replace the computed dynamic imports of the webpack runtime with imports of statically
 * known chunks, which Rollup can follow when Nitro bundles the server build.
 */
export class RollupCompatDynamicImportPlugin implements WebpackPluginInstance {
  apply (compiler: Compiler) {
    compiler.hooks.compilation.tap('RollupCompatDynamicImportPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'RollupCompatDynamicImportPlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
      }, (assets) => {
        // the webpack runtime lives in entry and runtime chunks
        const targetFiles = new Set<string>()
        for (const chunk of compilation.chunks) {
          if (chunk.canBeInitial() || chunk.hasRuntime()) {
            for (const file of chunk.files || []) {
              targetFiles.add(file)
            }
          }
        }

        for (const [filename, asset] of Object.entries(assets)) {
          if (!isJS(filename) || !targetFiles.has(filename)) {
            continue
          }

          const source = asset.source()
          const code = typeof source === 'string' ? source : source.toString()
          if (!DYNAMIC_IMPORT_RE.test(code)) {
            continue
          }

          const transformed = code.replace(DYNAMIC_IMPORT_REPLACE_RE, '_rollupDynamicImport($1).then')
          assets[filename] = new compiler.webpack.sources.RawSource(transformed.includes(HELPER_IMPORT) ? transformed : HELPER_IMPORT + transformed)
        }

        emitDynamicImportHelper(compilation)
      })
    })
  }
}

function emitDynamicImportHelper (compilation: Compilation) {
  const chunkFiles: string[] = []
  for (const chunk of compilation.chunks) {
    if (chunk.hasRuntime()) {
      continue
    }
    for (const filename of chunk.files) {
      if (filename && isJS(filename)) {
        chunkFiles.push(filename)
      }
    }
  }

  if (!chunkFiles.length) {
    return
  }

  const helper = `
const chunkMap = ${genObjectFromRawEntries(chunkFiles.map(filename => [filename, `() => import(${genString('./' + filename)})`]))}

export function _rollupDynamicImport(chunkId) {
  const chunk = chunkMap[chunkId]
  if (!chunk) {
    return Promise.reject(new Error(\`Chunk \${chunkId} not found in chunkMap. Available chunks: \${Object.keys(chunkMap).join(', ')}\`))
  }
  return chunk()
}
`
  compilation.emitAsset(HELPER_FILENAME, new compilation.compiler.webpack.sources.RawSource(helper))
}
