import type { Compiler } from 'webpack'
import { webpack } from '#builder'

const pluginName = 'ChunkErrorPlugin'

export class ChunkErrorPlugin {
  apply (compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.runtimeRequirementInTree
        .for(webpack.RuntimeGlobals.ensureChunk)
        .tap(pluginName, (chunk) => {
          compilation.addRuntimeModule(
            chunk,
            new ChunkErrorRuntimeModule(),
          )
        })
    })
  }
}

class ChunkErrorRuntimeModule extends webpack.RuntimeModule {
  constructor () {
    super('chunk preload error handler', webpack.RuntimeModule.STAGE_ATTACH)
  }

  override generate () {
    const { ensureChunk } = webpack.RuntimeGlobals
    return `
if (typeof ${ensureChunk} !== "undefined") {
  var _ensureChunk = ${ensureChunk};
  ${ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(function(error) {
      var e = new Event('nuxt:preloadError', { cancelable: true });
      e.payload = error;
      window.dispatchEvent(e);
      throw error;
    });
  };
}
`
  }
}
