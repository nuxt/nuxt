import type { Compiler } from 'webpack'
import webpack from 'webpack'

const pluginName = 'ChunkErrorPlugin'

const script = `
if (typeof ${webpack.RuntimeGlobals.require} !== "undefined") {
  var _ensureChunk = ${webpack.RuntimeGlobals.ensureChunk};
  ${webpack.RuntimeGlobals.ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(error => {
      useNuxtApp?.().callHook('app:chunkError', { error });
      if (!error.defaultPrevented) {
        throw error;
      }
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
