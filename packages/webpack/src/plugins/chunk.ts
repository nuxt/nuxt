import type { Compiler } from 'webpack'
import { RuntimeGlobals } from 'webpack'

const pluginName = 'ChunkErrorPlugin'

const script = `
if (typeof ${RuntimeGlobals.require} !== "undefined") {
  var _ensureChunk = ${RuntimeGlobals.ensureChunk};
  ${RuntimeGlobals.ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(err => {
      const e = new Event("nuxt.preloadError");
      e.payload = err;
      window.dispatchEvent(e);
      throw err;
    });
  };
};`

export class ChunkErrorPlugin {
  apply (compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(pluginName, compilation =>
      compilation.mainTemplate.hooks.localVars.tap(
        { name: pluginName, stage: 1 },
        source => source + script
      )
    )
  }
}
