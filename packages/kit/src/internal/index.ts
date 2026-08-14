/**
 * Utilities shared between first-party Nuxt packages (nuxt, vite, webpack, rspack,
 * nitro-server). Not public API: anything exported here may change in any release, and third
 * party modules should use the utilities exported from `@nuxt/kit` instead.
 *
 * @internal
 */

/**
 * Build-time diagnostics catalogs. Neither the codes nor their messages are part of Nuxt's
 * public API, and third-party modules should not report or throw `NUXT_B` codes. The `B8xxx`
 * kit-api catalog is intentionally not re-exported.
 */
export { buildDiagnostics } from '../diagnostics/build.ts'
export { pluginDiagnostics } from '../diagnostics/plugins.ts'
export { componentDiagnostics } from '../diagnostics/components.ts'
export { pageDiagnostics } from '../diagnostics/pages.ts'
export { configDiagnostics } from '../diagnostics/config.ts'
export { headDiagnostics } from '../diagnostics/head.ts'
export { bundlerDiagnostics } from '../diagnostics/bundler.ts'

export { loadJiti } from './jiti.ts'

export { parseNodeModulePath } from './node-module.ts'
export type { ParsedNodeModulePath } from './node-module.ts'

export { resolveModuleExportNames } from './exports.ts'
export type { ResolveModuleExportNamesOptions } from './exports.ts'

export { installModules } from '../module/install.ts'

export { DEFAULT_JS_FILE_EXTENSIONS, DEFAULT_JSX_FILE_EXTENSIONS } from '../constants.ts'
