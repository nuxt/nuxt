/**
 * Nuxt build-time error codes.
 *
 * Each code maps to a docs page at `https://nuxt.com/e/{code}`.
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
 *   B8xxx  Kit API
 */

import type { ErrorDefinition } from '../../shared/src/log.ts'

// ---------- B1xxx: Build / compilation ----------
/** Could not compile template */
export const B1001: ErrorDefinition = {
  code: 'B1001',
  message: 'Could not compile template {template}.',
}
/** Error reading template */
export const B1002: ErrorDefinition = {
  code: 'B1002',
  message: 'Error reading template {template}.',
}
/** Invalid template (missing src or getContents) */
export const B1003: ErrorDefinition = {
  code: 'B1003',
  message: 'Invalid template: missing `src` or `getContents`.',
}
/** Failed to install package */
export const B1004: ErrorDefinition = {
  code: 'B1004',
  message: 'Failed to install {name}.',
}
/** Compiler plugin failed to scan a file */
export const B1005: ErrorDefinition = {
  code: 'B1005',
  message: 'Plugin {plugin} failed to scan file {file}.',
}
/** Compiler plugin failed to read a file */
export const B1006: ErrorDefinition = {
  code: 'B1006',
  message: 'Cannot read file {file}.',
}
/** Compiler plugin afterScan hook error */
export const B1007: ErrorDefinition = {
  code: 'B1007',
  message: 'Error in `afterScan` hook of plugin {plugin}.',
}
/** No factory function found for keyed function (internal bug) */
export const B1008: ErrorDefinition = {
  code: 'B1008',
  message: 'No factory function found for `{function}` in file {file}. This is a Nuxt bug.',
}
/** Duplicate keyed function name */
export const B1009: ErrorDefinition = {
  code: 'B1009',
  message: 'Duplicate keyed function name `{functionName}`.',
}
/** Failed to read file (changed during read) */
export const B1010: ErrorDefinition = {
  code: 'B1010',
  message: 'Failed to read file {file} (file changed during read).',
}
/** Failed to read file (I/O error) */
export const B1011: ErrorDefinition = {
  code: 'B1011',
  message: 'Failed to read file {file}.',
}
/** Skipping unsafe cache path */
export const B1012: ErrorDefinition = {
  code: 'B1012',
  message: 'Skipping unsafe cache path {path}.',
}
/** Failed to restore cached file */
export const B1013: ErrorDefinition = {
  code: 'B1013',
  message: 'Failed to restore cached file {file}.',
}
/** Problem checking for external configuration files */
export const B1014: ErrorDefinition = {
  code: 'B1014',
  message: 'Problem checking for external configuration files.',
}
/** Falling back to chokidar-granular (parcel/watcher unavailable) */
export const B1015: ErrorDefinition = {
  code: 'B1015',
  message: 'Falling back to `chokidar-granular` watcher as `@parcel/watcher` is unavailable.',
}
/** Could not load @nuxt/webpack-builder */
export const B1016: ErrorDefinition = {
  code: 'B1016',
  message: 'Could not load `@nuxt/webpack-builder`.',
  fix: 'Run `npm install -D @nuxt/webpack-builder` to install it.',
}
/** Loading builder failed */
export const B1017: ErrorDefinition = {
  code: 'B1017',
  message: 'Loading builder failed: {builder}.',
}
/** Loading server builder failed */
export const B1018: ErrorDefinition = {
  code: 'B1018',
  message: 'Loading server builder failed.',
}
/** Unknown component mode (internal bug) */
export const B1019: ErrorDefinition = {
  code: 'B1019',
  message: 'Unknown component mode: {mode}. This is a Nuxt bug.',
}

// ---------- B2xxx: Plugins ----------
/** Invalid plugin metadata: not an object literal */
export const B2001: ErrorDefinition = {
  code: 'B2001',
  message: 'Invalid plugin metadata: not an object literal.',
}
/** Invalid plugin metadata: spread elements or computed keys */
export const B2002: ErrorDefinition = {
  code: 'B2002',
  message: 'Invalid plugin metadata: spread elements or computed keys are not supported.',
}
/** Invalid plugin metadata: dependsOn must be string array */
export const B2003: ErrorDefinition = {
  code: 'B2003',
  message: 'Invalid plugin metadata: `dependsOn` must be a string array.',
}
/** Plugin has no content */
export const B2004: ErrorDefinition = {
  code: 'B2004',
  message: 'Plugin {plugin} has no content.',
}
/** Plugin has no default export */
export const B2005: ErrorDefinition = {
  code: 'B2005',
  message: 'Plugin {plugin} has no default export.',
}
/** Error parsing plugin */
export const B2006: ErrorDefinition = {
  code: 'B2006',
  message: 'Error parsing plugin {plugin}.',
}
/** Plugin not wrapped in defineNuxtPlugin */
export const B2007: ErrorDefinition = {
  code: 'B2007',
  message: 'Plugin {plugin} is not wrapped in `defineNuxtPlugin`.',
}
/** Plugin depends on unregistered plugins */
export const B2008: ErrorDefinition = {
  code: 'B2008',
  message: 'Plugin {plugin} depends on unregistered plugins: {dependencies}.',
}
/** Circular dependency detected in plugins */
export const B2009: ErrorDefinition = {
  code: 'B2009',
  message: 'Circular dependency detected in plugins.',
}
/** Failed to parse plugin static properties */
export const B2010: ErrorDefinition = {
  code: 'B2010',
  message: 'Failed to parse static properties of plugin {plugin}.',
}
/** Invalid plugin: src option is required */
export const B2011: ErrorDefinition = {
  code: 'B2011',
  message: 'Invalid plugin: `src` option is required.',
}

// ---------- B3xxx: Components ----------
/** Components directory not found */
export const B3001: ErrorDefinition = {
  code: 'B3001',
  message: 'Components directory not found: {directory}.',
}
/** Server components with ssr:false requires componentIslands */
export const B3002: ErrorDefinition = {
  code: 'B3002',
  message: 'Server components with `ssr: false` require `componentIslands` to be enabled.',
}
/** Standalone server components require componentIslands */
export const B3003: ErrorDefinition = {
  code: 'B3003',
  message: 'Standalone server components require `componentIslands` to be enabled.',
}
/** Component requires module installation */
export const B3004: ErrorDefinition = {
  code: 'B3004',
  message: 'Component {component} requires module installation.',
}
/** Multiple hydration strategies on same component */
export const B3005: ErrorDefinition = {
  code: 'B3005',
  message: 'Multiple hydration strategies detected on the same component.',
}
/** Lazy-hydration on non-lazy component */
export const B3006: ErrorDefinition = {
  code: 'B3006',
  message: 'Lazy hydration strategy used on non-lazy component.',
}
/** nuxt-client attribute requires selectiveClient or Vite */
export const B3007: ErrorDefinition = {
  code: 'B3007',
  message: '`nuxt-client` attribute requires `selectiveClient` feature or Vite.',
}
/** Component name typo (case-sensitive directory) */
export const B3008: ErrorDefinition = {
  code: 'B3008',
  message: 'Component name {component} may be a typo (case-sensitive directory).',
}
/** Reserved "Lazy" prefix on component */
export const B3009: ErrorDefinition = {
  code: 'B3009',
  message: 'Component {component} uses the reserved `Lazy` prefix.',
}
/** Component did not resolve to a file name */
export const B3010: ErrorDefinition = {
  code: 'B3010',
  message: 'Component {component} did not resolve to a file name.',
}
/** Duplicate component name */
export const B3011: ErrorDefinition = {
  code: 'B3011',
  message: 'Two component files resolving to the same name {component}.',
}
/** Overriding component without priority */
export const B3012: ErrorDefinition = {
  code: 'B3012',
  message: 'Overriding component {component} without setting a priority.',
}

// ---------- B4xxx: Pages / routing ----------
/** Page file has no content */
export const B4001: ErrorDefinition = {
  code: 'B4001',
  message: 'Page file {file} has no content.',
}
/** Await in definePageMeta */
export const B4002: ErrorDefinition = {
  code: 'B4002',
  message: '`await` is not allowed inside `definePageMeta`.',
}
/** Multiple definePageMeta calls */
export const B4003: ErrorDefinition = {
  code: 'B4003',
  message: 'Multiple `definePageMeta` calls detected in {file}.',
}
/** Duplicate route name */
export const B4004: ErrorDefinition = {
  code: 'B4004',
  message: 'Route name generated for `{file}` is the same as `{existingFile}`.',
  fix: 'Set a custom name using `definePageMeta` within one of the page files.',
}
/** definePageMeta must be called with object literal */
export const B4005: ErrorDefinition = {
  code: 'B4005',
  message: '`{fnName}` must be called with an object literal.',
}
/** definePageMeta must be called with serializable literal */
export const B4006: ErrorDefinition = {
  code: 'B4006',
  message: '`{fnName}` must be called with a serializable object literal.',
}
/** Error transforming page macro */
export const B4007: ErrorDefinition = {
  code: 'B4007',
  message: 'Error while transforming `{fnName}()`.',
}
/** Server pages with ssr:false requires componentIslands */
export const B4008: ErrorDefinition = {
  code: 'B4008',
  message: 'Server pages with `ssr: false` require `componentIslands` to be enabled.',
}
/** No layout name could be resolved */
export const B4009: ErrorDefinition = {
  code: 'B4009',
  message: 'No layout name could be resolved for {file}.',
}
/** No middleware name could be resolved */
export const B4010: ErrorDefinition = {
  code: 'B4010',
  message: 'No middleware name could be resolved for {file}.',
}
/** Generic page tree warning (from unplugin-vue-router) */
export const B4011: ErrorDefinition = {
  code: 'B4011',
  message: '{message}',
}
/** Incremental route update failed */
export const B4012: ErrorDefinition = {
  code: 'B4012',
  message: 'Incremental route update failed.',
}
/** Middleware already exists (name conflict) */
export const B4013: ErrorDefinition = {
  code: 'B4013',
  message: 'Middleware {name} already exists.',
}
/** Not overriding existing layout */
export const B4014: ErrorDefinition = {
  code: 'B4014',
  message: 'Not overriding existing layout {name}.',
}

// ---------- B5xxx: Configuration ----------
/** Missing compatibilityDate */
export const B5001: ErrorDefinition = {
  code: 'B5001',
  message: 'No `compatibilityDate` is set in your Nuxt config.',
  fix: 'Add `compatibilityDate` to your config to opt-in to new defaults.',
}
/** Failed to install webpack builder */
export const B5002: ErrorDefinition = {
  code: 'B5002',
  message: 'Failed to install `@nuxt/webpack-builder`.',
}
/** Reserved runtimeConfig.app namespace */
export const B5003: ErrorDefinition = {
  code: 'B5003',
  message: '`runtimeConfig.app` is reserved for Nuxt internal use.',
}
/** External config file not supported */
export const B5004: ErrorDefinition = {
  code: 'B5004',
  message: 'External config file `{file}` is not supported.',
}
/** Unable to load schema */
export const B5005: ErrorDefinition = {
  code: 'B5005',
  message: 'Unable to load schema.',
}
/** Webpack hash in dev mode causes memory leak */
export const B5006: ErrorDefinition = {
  code: 'B5006',
  message: 'Webpack `hash` in dev mode may cause a memory leak.',
}
/** Webpack target should be "node" */
export const B5007: ErrorDefinition = {
  code: 'B5007',
  message: 'Webpack target should be `node`.',
}
/** Unknown PostCSS order preset */
export const B5008: ErrorDefinition = {
  code: 'B5008',
  message: 'Unknown PostCSS order preset: {preset}.',
}
/** Falling back to chokidar for schema watching */
export const B5009: ErrorDefinition = {
  code: 'B5009',
  message: 'Falling back to `chokidar` for schema watching.',
}
/** Missing packages (dependency check) */
export const B5010: ErrorDefinition = {
  code: 'B5010',
  message: 'Missing packages: {packages}.',
}
/** Package is missing (module install) */
export const B5011: ErrorDefinition = {
  code: 'B5011',
  message: 'Package {name} is missing.',
}
/** Run command to install missing package */
export const B5012: ErrorDefinition = {
  code: 'B5012',
  message: 'Run `npx nuxt add {name}` to install it.',
}

// ---------- B6xxx: Head / imports ----------
/** Importing from @unhead/vue instead of #imports */
export const B6001: ErrorDefinition = {
  code: 'B6001',
  message: 'Importing from `@unhead/vue` instead of `#imports`.',
  fix: 'Use `import { ... } from \'#imports\'` instead.',
}
/** Auto-import name conflict with Nuxt built-in */
export const B6002: ErrorDefinition = {
  code: 'B6002',
  message: 'Auto-import name conflict with Nuxt built-in: {name}.',
}

// ---------- B7xxx: Webpack / Vite bundler ----------
/** Bundle analysis requires rollup-plugin-visualizer */
export const B7001: ErrorDefinition = {
  code: 'B7001',
  message: 'Bundle analysis requires `rollup-plugin-visualizer`.',
  fix: 'Run `npm install -D rollup-plugin-visualizer` to install it.',
}
/** Vite optimizeDeps stale */
export const B7002: ErrorDefinition = {
  code: 'B7002',
  message: 'Vite `optimizeDeps` may be stale.',
}
/** Server bundle should have one entry file */
export const B7003: ErrorDefinition = {
  code: 'B7003',
  message: 'Server bundle should have exactly one entry file.',
}
/** Webpack entry not found */
export const B7004: ErrorDefinition = {
  code: 'B7004',
  message: 'Webpack entry not found: {entry}.',
}
/** No client entry in rollupOptions */
export const B7005: ErrorDefinition = {
  code: 'B7005',
  message: 'No client entry found in `rollupOptions.input`.',
}
/** No server entry in rollupOptions */
export const B7006: ErrorDefinition = {
  code: 'B7006',
  message: 'No server entry found in `rollupOptions.input`.',
}
/** Could not load PostCSS plugin (vite) */
export const B7007: ErrorDefinition = {
  code: 'B7007',
  message: 'Could not load PostCSS plugin `{pluginName}`.',
}
/** Install @vitejs/plugin-vue-jsx for JSX support */
export const B7008: ErrorDefinition = {
  code: 'B7008',
  message: 'Install `@vitejs/plugin-vue-jsx` to enable JSX support.',
  fix: 'Run `npm install -D @vitejs/plugin-vue-jsx` to install it.',
}
/** Install packages for decorator support */
export const B7009: ErrorDefinition = {
  code: 'B7009',
  message: 'Install packages for decorator support.',
}
/** Install packages for decorator support (nitro) */
export const B7010: ErrorDefinition = {
  code: 'B7010',
  message: 'Install packages for decorator support (nitro).',
}
/** Could not import PostCSS plugin (webpack) */
export const B7011: ErrorDefinition = {
  code: 'B7011',
  message: 'Could not import PostCSS plugin `{pluginName}`.',
}
/** Buffer size limit exceeded (ViteNode) */
export const B7012: ErrorDefinition = {
  code: 'B7012',
  message: 'Buffer size limit exceeded: {requiredSize} > {maxSize}.',
}
/** Socket path not configured (ViteNode) */
export const B7013: ErrorDefinition = {
  code: 'B7013',
  message: 'Socket path not configured for ViteNodeSocketServer.',
}
/** Webpack build failed */
export const B7014: ErrorDefinition = {
  code: 'B7014',
  message: 'Webpack build failed.',
}
/** Payload extraction recommended for full-static output */
export const B7015: ErrorDefinition = {
  code: 'B7015',
  message: 'Payload extraction is recommended for full-static output.',
}
/** Custom spaLoadingTemplate not found */
export const B7016: ErrorDefinition = {
  code: 'B7016',
  message: 'Custom `spaLoadingTemplate` not found: {path}.',
}

// ---------- B8xxx: Kit API ----------
/** Nuxt instance is unavailable */
export const B8001: ErrorDefinition = {
  code: 'B8001',
  message: 'Nuxt instance is unavailable.',
}
/** `base` argument missing for createResolver */
export const B8002: ErrorDefinition = {
  code: 'B8002',
  message: '`base` argument is missing for `createResolver`.',
}
/** Nitro not initialized yet */
export const B8003: ErrorDefinition = {
  code: 'B8003',
  message: 'Nitro is not initialized yet. Use the `ready` hook to access Nitro.',
}
/** Nuxt compatibility issues found */
export const B8004: ErrorDefinition = {
  code: 'B8004',
  message: 'Nuxt compatibility issues found.',
}
/** Cannot determine nuxt version */
export const B8005: ErrorDefinition = {
  code: 'B8005',
  message: 'Cannot determine Nuxt version.',
}
/** Cannot find any nuxt version from cwd */
export const B8006: ErrorDefinition = {
  code: 'B8006',
  message: 'Cannot find any Nuxt version from current working directory.',
}
/** Invalid type template: filename must end with .d.ts */
export const B8007: ErrorDefinition = {
  code: 'B8007',
  message: 'Invalid type template: filename must end with `.d.ts`.',
}
/** Invalid template (falsy value) */
export const B8008: ErrorDefinition = {
  code: 'B8008',
  message: 'Invalid template: received a falsy value.',
}
/** Template not found (src does not exist) */
export const B8009: ErrorDefinition = {
  code: 'B8009',
  message: 'Template not found: `{src}` does not exist.',
}
/** Invalid template: neither getContents nor src provided */
export const B8010: ErrorDefinition = {
  code: 'B8010',
  message: 'Invalid template: neither `getContents` nor `src` provided.',
}
/** Invalid template: filename must be provided */
export const B8011: ErrorDefinition = {
  code: 'B8011',
  message: 'Invalid template: `filename` must be provided.',
}
/** Cannot use module outside of Nuxt context */
export const B8012: ErrorDefinition = {
  code: 'B8012',
  message: 'Cannot use module outside of Nuxt context.',
}
/** Module disabled due to incompatibility */
export const B8013: ErrorDefinition = {
  code: 'B8013',
  message: 'Module {name} disabled due to incompatibility.',
}
/** Slow module setup time */
export const B8014: ErrorDefinition = {
  code: 'B8014',
  message: 'Module {name} took a long time to set up ({time}ms).',
}
/** Nuxt module should be a function or string */
export const B8015: ErrorDefinition = {
  code: 'B8015',
  message: 'Nuxt module should be a function or string.',
}
/** Nuxt module should be a function */
export const B8016: ErrorDefinition = {
  code: 'B8016',
  message: 'Nuxt module should be a function: {module}.',
}
/** Could not load module */
export const B8017: ErrorDefinition = {
  code: 'B8017',
  message: 'Could not load module {name}.',
}
/** Error while importing module */
export const B8018: ErrorDefinition = {
  code: 'B8018',
  message: 'Error while importing module {name}.',
}
/** Error in module install/upgrade hook */
export const B8019: ErrorDefinition = {
  code: 'B8019',
  message: 'Error in module {action} hook for {name}.',
}
