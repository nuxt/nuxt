import type { Compiler } from 'webpack'
import { webpack } from '#builder'

const pluginName = 'ChunkErrorPlugin'

export class ChunkErrorPlugin {
  script = `
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

  apply (compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(pluginName, compilation =>
      compilation.mainTemplate.hooks.localVars.tap(
        { name: pluginName, stage: 1 },
        source => source + this.script,
      ),
    )
  }
}
