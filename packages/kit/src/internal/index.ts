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
export { docsBase } from '../diagnostics/_shared.ts'

export { reportPendingTemplates, trackPendingTemplate } from './pending-templates.ts'

export { describeNativeImportFailure, getMissingCjsGlobal, isLoaderError, isMissingExportError, loadJiti, shouldReportJitiFallbackOnce } from './jiti.ts'

export { findPackageMissingSubpath } from '../dependency.ts'

export { resolvePostcssPluginPath, resolvePostcssPlugins } from './postcss.ts'

export { lookupNodeModuleSubpath, parseNodeModulePath } from './node-module.ts'
export type { ParsedNodeModulePath } from './node-module.ts'

export { hasOwnSubpathImport } from './subpath-imports.ts'

export { isWithinDir } from './paths.ts'

export { VUE_PACKAGE_NAMES, VUE_PACKAGE_SPECIFIER_RE, isInVuePackages, resolveVuePackageImporter, resolveVuePackages } from './vue-packages.ts'
export type { VuePackageName, VuePackages } from './vue-packages.ts'

export { MAY_CONTAIN_DECORATOR_RE, hasDecoratorSyntax } from './decorators.ts'

export { decodeRoutePath, encodeRoutePath, foldRouteCase, foldRouteRulePath, matchAllRouteRules } from './route-path.ts'
export { assertCaseIndependentRouteRuleKey, assertEncodingIndependentRouteRuleKey, assertSingleCatchAllRouteRuleKey, createNormalizedRouteRulesRouter, createRouteRulesRouter, encodeRoutePattern, findCaseDependentConstraint, findCaseDependentRouteRuleKeyPart, findEncodingDependentConstraint, foldRouteRulePattern, genNormalizePathCode, isWildcardRedirect, mergeMethodRouteRulesRoutes, normalizeAppMiddlewareRules, normalizeRouteRuleKey, normalizeRouteRuleLookupPath, normalizeRouteRulePath, normalizeRouteRules, parseRouteRulesRoute, resolveRouteRulesRoutes, resolveWildcardRedirect } from './route-rules.ts'
export type { RouteRulesRoute, RouteRulesRouter } from './route-rules.ts'

export { resolveModuleExportNames } from './exports.ts'
export type { ResolveModuleExportNamesOptions } from './exports.ts'

export { kServerApi, kUnusedVariants } from '../nitro.ts'

export { installModules } from '../module/install.ts'

export { DEFAULT_JS_FILE_EXTENSIONS, DEFAULT_JSX_FILE_EXTENSIONS } from '../constants.ts'

export { createServerBuild, resolveNitroDeployCommand, setServerBuild, useServerBuild } from './server-build.ts'

export { reportNitroPrerender, startBuildEnvironment } from './build-report.ts'
export type { BuildEnvironmentReport } from './build-report.ts'

export { addClientBuildState, restoreClientBuildState, saveClientBuildState, waitForClientBuild } from './client-build-state.ts'
export type { ClientBuildState } from './client-build-state.ts'

export { SERVER_RUNTIME_VERSION, getServerRuntime } from './renderer.ts'

export { resolveSpaLoadingTemplate, resolveSpaLoadingTemplatePath } from './spa-loading-template.ts'

export { findRuntimeConfigSchema, getRuntimeConfigSchema, resolveRuntimeConfig, runtimeConfigSchemaToType } from './runtime-config.ts'
export type { NuxtServerRuntime, NuxtServerRuntimeModule, RendererConfigName, ServerRuntimeOptions } from './renderer.ts'
