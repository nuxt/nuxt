import { extname } from 'path'
import type { Plugin, RenderedChunk } from 'rollup'

export interface Options { }

const TIMING = 'global.__timing__'

const iife = code => `(function() { ${code.trim()} })();`.replace(/\n/g, '')

const HELPER = TIMING + '=' + iife(`
const hrtime = global.process.hrtime;
const start = () => hrtime();
const end = s => { const d = hrtime(s); return ((d[0] * 1e9) + d[1]) / 1e6; };

const _s = {};
const metrics = [];
const logStart = id => { _s[id] = hrtime(); };
const logEnd = id => { const t = end(_s[id]); delete _s[id]; metrics.push([id, t]); console.log('◈', id, t, 'ms'); };
return { hrtime, start, end, metrics, logStart, logEnd };
`)

export function timing (_opts: Options = {}): Plugin {
  return {
    name: 'timing',
    renderChunk (code, chunk: RenderedChunk) {
      let name = chunk.fileName || ''
      name = name.replace(extname(name), '')
      return "'use strict';" + (chunk.isEntry ? HELPER : '') + `${TIMING}.logStart('import:${name}');` + code + `;${TIMING}.logEnd('import:${name}');`
    }
  }
}
