import { extname } from 'upath'
import type { Plugin, RenderedChunk } from 'rollup'

export interface Options { }

const TIMING = 'global.__timing__'

const iife = code => `(function() { ${code.trim()} })();`.replace(/\n/g, '')

// https://gist.github.com/pi0/1476085924f8a2eb1df85929c20cb43f
const POLYFILL = `const global="undefined"!=typeof globalThis?globalThis:void 0!==o?o:"undefined"!=typeof self?self:{};
global.process = global.process || {};
const o=Date.now(),t=()=>Date.now()-o;global.process.hrtime=global.process.hrtime||(o=>{const e=Math.floor(.001*(Date.now()-t())),a=.001*t();let l=Math.floor(a)+e,n=Math.floor(a%1*1e9);return o&&(l-=o[0],n-=o[1],n<0&&(l--,n+=1e9)),[l,n]});`

const HELPER = POLYFILL + iife(`
const hrtime = global.process.hrtime;
const start = () => hrtime();
const end = s => { const d = hrtime(s); return ((d[0] * 1e9) + d[1]) / 1e6; };

const _s = {};
const metrics = [];
const logStart = id => { _s[id] = hrtime(); };
const logEnd = id => { const t = end(_s[id]); delete _s[id]; metrics.push([id, t]); console.debug('>', id + ' (' + t + 'ms)'); };
${TIMING} = { hrtime, start, end, metrics, logStart, logEnd };
`)

export function timing (_opts: Options = {}): Plugin {
  return {
    name: 'timing',
    renderChunk (code, chunk: RenderedChunk) {
      let name = chunk.fileName || ''
      name = name.replace(extname(name), '')
      const logName = name === 'index' ? 'Cold Start' : ('Load ' + name)
      return {
        code: (chunk.isEntry ? HELPER : '') + `${TIMING}.logStart('${logName}');` + code + `;${TIMING}.logEnd('${logName}');`,
        map: null
      }
    }
  }
}
