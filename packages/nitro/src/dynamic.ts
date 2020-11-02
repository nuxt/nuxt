import { join } from 'path'
import globby from 'globby'

export async function createDynamicImporter (cwd: string) {
  const assets = await globby('**/*.js', { cwd, absolute: false })
  const chunkInfo = {}
  for (const asset of assets) {
    const { id, ids, modules } = require(join(cwd, asset))
    if ((id || ids) && modules) {
      chunkInfo[asset] = { id, ids, modules: Object.keys(modules) }
    }
  }

  return (syncImport, asyncImport) => genRequireDynamic(chunkInfo, syncImport, asyncImport)
}

export function genRequireDynamic (chunkInfo, syncImport, asyncImport) {
  return `\nconst _dynamic_chunks = ${JSON.stringify(chunkInfo, null, 2)};
function requireDynamic (chunkId) {
  const chunk = _dynamic_chunks[chunkId]

  if (!chunk) {
    return ${syncImport}
  }

  const promise = ${asyncImport}

  if (Array.isArray(chunk.modules)) {
    const modules = {}
    for (const id of chunk.modules) {
      modules[id] = function (module, _exports, _require) {
        module.exports = promise.then(chunk => {
          const asyncModule = { exports: {}, require: _require }
          chunk.modules[id](asyncModule, asyncModule.exports, asyncModule.require)
          return asyncModule.exports
        })
      }
    }
    chunk.modules = modules
  }

  return chunk
};`
}
