import MagicString from 'magic-string'
import type { NastiPlugin } from '@nasti-toolchain/nasti'

const QUERY_RE = /\?.+$/

// Standard module-preload polyfill (inlined). Nasti does not expose a
// `nasti/modulepreload-polyfill` virtual the way Vite does, so we prepend the polyfill
// directly to the client entry. Polyfills `<link rel="modulepreload">` for browsers that
// support `import()` but not modulepreload (notably Firefox/Safari historically).
const POLYFILL = `(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))r(l);new MutationObserver((m)=>{for(const a of m)if(a.type==="childList")for(const l of a.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function o(l){const t={};return l.integrity&&(t.integrity=l.integrity),l.referrerPolicy&&(t.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?t.credentials="include":l.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function r(l){if(l.ep)return;l.ep=!0;const t=o(l);fetch(l.href,t)}})();\n`

/**
 * Injects the module-preload polyfill into the client entry, mirroring
 * `@nuxt/vite-builder`'s `ModulePreloadPolyfillPlugin`. Client environment only.
 *
 * @param clientEntry Absolute path of the resolved client entry module.
 */
export function ModulePreloadPolyfillPlugin (clientEntry: string): NastiPlugin {
  return {
    name: 'nuxt:nasti:module-preload-polyfill',
    applyToEnvironment: environment => environment.name === 'client',
    transform (code, id) {
      if (id.replace(QUERY_RE, '') !== clientEntry) {
        return
      }
      const s = new MagicString(code)
      s.prepend(POLYFILL)
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}
