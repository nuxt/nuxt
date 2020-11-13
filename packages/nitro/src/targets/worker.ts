import { SLSTarget } from '../config'

// https://gist.github.com/pi0/1476085924f8a2eb1df85929c20cb43f

const polyfill = `
const exports = {};
const module = { exports };
const global = typeof globalThis !== 'undefined' ? globalThis : "undefined" !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
global.process = global.process || {};
(function(){const o=Date.now(),t=()=>Date.now()-o;global.process.hrtime=o=>{const e=Math.floor(.001*(Date.now()-t())),n=.001*t();let a=Math.floor(n)+e,r=Math.floor(n%1*1e9);return o&&(a-=o[0],r-=o[1],r<0&&(a--,r+=1e9)),[a,r]};})();
`

export const worker: SLSTarget = {
  entry: null, // Abstract
  node: false,
  hooks: {
    'rollup:before' ({ rollupConfig }) {
      rollupConfig.output.intro = polyfill + rollupConfig.output.intro
      rollupConfig.output.format = 'iife'
    }
  }
}
