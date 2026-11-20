/**
 * Named-export stub for `#build/pages`, used only via `paths` in
 * `tsconfig.build.json` while emitting this package's declarations. The
 * generated `pages.mjs` re-exports these from `vue-router`.
 */
export { START_LOCATION, parseQuery, stringifyQuery, useRoute } from 'vue-router'
export declare function parseURL (location: string, currentLocation?: string): { path: string, query: import('vue-router').LocationQuery, hash: string }
