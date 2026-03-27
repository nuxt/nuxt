/**
 * Nuxt build-time error codes.
 *
 * Each code maps to a docs page at `https://nuxt.com/docs/errors/{code}`.
 * Codes are stable — once assigned they must not be reused or renumbered.
 *
 * Ranges:
 *   B1xxx  Build / compilation
 *   B2xxx  Plugins
 *   B3xxx  Components
 *   B4xxx  Pages / routing
 *   B5xxx  Configuration
 *   B6xxx  Head / imports
 *   B7xxx  Webpack / Vite bundler
 */

// ---------- B1xxx: Build / compilation ----------
/** Could not compile template */
export const B1001 = 'B1001'
/** Error reading template */
export const B1002 = 'B1002'
/** Invalid template (missing src or getContents) */
export const B1003 = 'B1003'
/** Failed to install package */
export const B1004 = 'B1004'
/** Compiler plugin failed to scan a file */
export const B1005 = 'B1005'
/** Compiler plugin failed to read a file */
export const B1006 = 'B1006'
/** Compiler plugin afterScan hook error */
export const B1007 = 'B1007'
/** No factory function found for keyed function (internal bug) */
export const B1008 = 'B1008'
/** Duplicate keyed function name */
export const B1009 = 'B1009'

// ---------- B2xxx: Plugins ----------
/** Invalid plugin metadata: not an object literal */
export const B2001 = 'B2001'
/** Invalid plugin metadata: spread elements or computed keys */
export const B2002 = 'B2002'
/** Invalid plugin metadata: dependsOn must be string array */
export const B2003 = 'B2003'
/** Plugin has no content */
export const B2004 = 'B2004'
/** Plugin has no default export */
export const B2005 = 'B2005'
/** Error parsing plugin */
export const B2006 = 'B2006'
/** Plugin not wrapped in defineNuxtPlugin */
export const B2007 = 'B2007'
/** Plugin depends on unregistered plugins */
export const B2008 = 'B2008'
/** Circular dependency detected in plugins */
export const B2009 = 'B2009'
/** Failed to parse plugin static properties */
export const B2010 = 'B2010'

// ---------- B3xxx: Components ----------
/** Components directory not found */
export const B3001 = 'B3001'
/** Server components with ssr:false requires componentIslands */
export const B3002 = 'B3002'
/** Standalone server components require componentIslands */
export const B3003 = 'B3003'
/** Component requires module installation */
export const B3004 = 'B3004'
/** Multiple hydration strategies on same component */
export const B3005 = 'B3005'
/** Lazy-hydration on non-lazy component */
export const B3006 = 'B3006'
/** nuxt-client attribute requires selectiveClient or Vite */
export const B3007 = 'B3007'
/** Component name typo (case-sensitive directory) */
export const B3008 = 'B3008'
/** Reserved "Lazy" prefix on component */
export const B3009 = 'B3009'
/** Component did not resolve to a file name */
export const B3010 = 'B3010'
/** Duplicate component name */
export const B3011 = 'B3011'

// ---------- B4xxx: Pages / routing ----------
/** Page file has no content */
export const B4001 = 'B4001'
/** Await in definePageMeta */
export const B4002 = 'B4002'
/** Multiple definePageMeta calls */
export const B4003 = 'B4003'
/** Duplicate route name */
export const B4004 = 'B4004'
/** definePageMeta must be called with object literal */
export const B4005 = 'B4005'
/** definePageMeta must be called with serializable literal */
export const B4006 = 'B4006'
/** Error transforming page macro */
export const B4007 = 'B4007'
/** Server pages with ssr:false requires componentIslands */
export const B4008 = 'B4008'
/** No layout name could be resolved */
export const B4009 = 'B4009'
/** No middleware name could be resolved */
export const B4010 = 'B4010'

// ---------- B5xxx: Configuration ----------
/** Missing compatibilityDate */
export const B5001 = 'B5001'
/** Failed to install webpack builder */
export const B5002 = 'B5002'
/** Reserved runtimeConfig.app namespace */
export const B5003 = 'B5003'
/** External config file not supported */
export const B5004 = 'B5004'
/** Unable to load schema */
export const B5005 = 'B5005'
/** Webpack hash in dev mode causes memory leak */
export const B5006 = 'B5006'
/** Webpack target should be "node" */
export const B5007 = 'B5007'
/** Unknown PostCSS order preset */
export const B5008 = 'B5008'

// ---------- B6xxx: Head / imports ----------
/** Importing from @unhead/vue instead of #imports */
export const B6001 = 'B6001'
/** Auto-import name conflict with Nuxt built-in */
export const B6002 = 'B6002'

// ---------- B7xxx: Webpack / Vite bundler ----------
/** Bundle analysis requires rollup-plugin-visualizer */
export const B7001 = 'B7001'
/** Vite optimizeDeps stale */
export const B7002 = 'B7002'
/** Server bundle should have one entry file */
export const B7003 = 'B7003'
/** Webpack entry not found */
export const B7004 = 'B7004'
/** No client entry in rollupOptions */
export const B7005 = 'B7005'
/** No server entry in rollupOptions */
export const B7006 = 'B7006'
