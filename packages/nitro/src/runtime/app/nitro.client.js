import { $fetch } from 'ohmyfetch'

global.process = global.process || {};

(function () { const o = Date.now(); const t = () => Date.now() - o; global.process.hrtime = global.process.hrtime || ((o) => { const e = Math.floor(0.001 * (Date.now() - t())); const a = 0.001 * t(); let l = Math.floor(a) + e; let n = Math.floor(a % 1 * 1e9); return o && (l -= o[0], n -= o[1], n < 0 && (l--, n += 1e9)), [l, n] }) })()

global.$fetch = $fetch
