import type { Compiler } from 'webpack'
import webpack from 'webpack'

const pluginName = 'ChunkErrorPlugin'

const script = `
if (typeof ${webpack.RuntimeGlobals.require} !== "undefined") {
  var _ensureChunk = ${webpack.RuntimeGlobals.ensureChunk};
  ${webpack.RuntimeGlobals.ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(error => {
      const e = new Event('nuxt:preloadError', { cancelable: true })
      e.payload = error
      window.dispatchEvent(e)
      throw error
    });
  };
};`

export class ChunkErrorPlugin {
  apply (compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(pluginName, compilation =>
      compilation.mainTemplate.hooks.localVars.tap(
        { name: pluginName, stage: 1 },
        source => source + script,
      ),
    )
  }
}
