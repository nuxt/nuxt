import { SLSTarget } from '../config'

const polyfill = `
const exports = {};
const module = { exports };
const process = { env: {} };
const performance = {};

// https://github.com/cabinjs/browser-hrtime
'!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):(e="undefined"!=typeof globalThis?globalThis:e||self).hrtime=n()}(this,(function(){"use strict";var e=function(e){!function(){if("performance"in window==0&&(window.performance={}),Date.now=Date.now||function(){return(new Date).getTime()},"now"in window.performance==0){var e=Date.now();performance.timing&&performance.timing.navigationStart&&(e=performance.timing.navigationStart),window.performance.now=function(){return Date.now()-e}}}();var n=Math.floor(.001*(Date.now()-performance.now())),o=.001*performance.now(),r=Math.floor(o)+n,i=Math.floor(o%1*1e9);return e&&(r-=e[0],(i-=e[1])<0&&(r--,i+=1e9)),[r,i]};return e.bigint=function(n){var o=e(n);return 1e9*o[0]+o[1]},"undefined"!=typeof process&&void 0!==process.hrtime||void 0!==window.process||(window.process={}),void 0===process.hrtime?window.process.hrtime=e:process.hrtime}));'

const global = { process };
const window = global;
`

export const worker: SLSTarget = {
  entry: '{{ runtimeDir }}/worker',
  node: false,
  hooks: {
    'rollup:before' ({ rollupConfig }) {
      rollupConfig.output.intro = polyfill + rollupConfig.output.intro
      rollupConfig.output.format = 'iife'
    }
  }
}
