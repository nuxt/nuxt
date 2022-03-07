import { extname } from 'pathe'
import type { Plugin, RenderedChunk } from 'rollup'

export interface Options { }

const TIMING = 'globalThis.__timing__'

const iife = code => `(function() { ${code.trim()} })();`.replace(/\n/g, '')

const HELPER = iife(`
const start = () => Date.now();
const end = s => Date.now() - s;
const _s = {};
const metrics = [];
const logStart = id => { _s[id] = Date.now(); };
const logEnd = id => { const t = end(_s[id]); delete _s[id]; metrics.push([id, t]); console.debug('>', id + ' (' + t + 'ms)'); };
${TIMING} = { start, end, metrics, logStart, logEnd };
`)

const HELPERIMPORT = "import './timing.js';"

export function timing (_opts: Options = {}): Plugin {
  return {
    name: 'timing',
    generateBundle () {
      this.emitFile({
        type: 'asset',
        fileName: 'timing.js',
        source: HELPER
      })
    },
    renderChunk (code, chunk: RenderedChunk) {
      let name = chunk.fileName || ''
      name = name.replace(extname(name), '')

      const logName = name === 'index' ? 'Nitro Start' : ('Load ' + name)

      return {
        code: (chunk.isEntry ? HELPERIMPORT : '') + `${TIMING}.logStart('${logName}');` + code + `;${TIMING}.logEnd('${logName}');`,
        map: null
      }
    }
  }
}
