import { DEFAULT_JSX_FILE_EXTENSIONS as _DEFAULT_JSX_FILE_EXTENSIONS, DEFAULT_JS_FILE_EXTENSIONS as _DEFAULT_JS_FILE_EXTENSIONS } from './constants.ts'

// Module
export { defineNuxtModule } from './module/define.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getDirectory, installModule, loadNuxtModuleInstance, normalizeModuleTranspilePath, resolveModuleWithOptions } from './module/install.ts'
export { getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility } from './module/compatibility.ts'

// Loader
export { diffNuxtConfig, loadNuxtConfig } from './loader/config.ts'
export type { LoadNuxtConfigOptions, NuxtConfigDiffEntry, ResolvedNuxtConfigContext } from './loader/config.ts'
export { extendNuxtSchema } from './loader/schema.ts'
export { buildNuxt, loadNuxt } from './loader/nuxt.ts'
export type { LoadNuxtOptions } from './loader/nuxt.ts'

// Layers
export { getLayerDirectories } from './layers.ts'
export type { LayerDirectories } from './layers.ts'

// Constants
/** @deprecated Internal. Import from `@nuxt/kit/internal` instead. */
export const DEFAULT_JS_FILE_EXTENSIONS: string[] = _DEFAULT_JS_FILE_EXTENSIONS
/** @deprecated Internal. Import from `@nuxt/kit/internal` instead. */
export const DEFAULT_JSX_FILE_EXTENSIONS: string[] = _DEFAULT_JSX_FILE_EXTENSIONS

// Utils
export { setGlobalHead } from './head.ts'
export { addImports, addImportsDir, addImportsSources } from './imports.ts'
export { updateAppConfig } from './app-config.ts'
export { updateRuntimeConfig, useRuntimeConfig } from './runtime-config.ts'
export { addBuildPlugin, addVitePlugin, addRspackPlugin, addWebpackPlugin, extendViteConfig, extendRspackConfig, extendWebpackConfig, setBuildOutput } from './build.ts'
export type { ExtendConfigOptions, ExtendViteConfigOptions, ExtendWebpackConfigOptions } from './build.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { assertNuxtCompatibility, checkNuxtCompatibility, getNitroVersion, getNuxtVersion, hasNitroVersion, hasNuxtCompatibility, isNuxtMajorVersion, normalizeSemanticVersion, isNuxt2, isNuxt3 } from './compatibility.ts'
export type { NuxtMajorVersion } from './compatibility.ts'
export { addComponent, addComponentExports, addComponentsDir } from './components.ts'
export type { AddComponentOptions } from './components.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getNuxtCtx, runWithNuxtContext, tryUseNuxt, useNuxt, nuxtCtx } from './context.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type { NuxtContext } from './context.ts'
export { createIsIgnored, isIgnored, resolveIgnorePatterns } from './ignore.ts'
export { addLayout } from './layout.ts'
export { addRouteMiddleware, extendPages, extendRouteRules } from './pages.ts'
export type { AddRouteMiddlewareOptions, ExtendRouteRulesOptions } from './pages.ts'
export { addPlugin, addPluginTemplate, normalizePlugin } from './plugin.ts'
export type { AddPluginOptions } from './plugin.ts'
export { createResolver, findPath, resolveAlias, resolveFiles, resolveNuxtModule, resolvePath } from './resolve.ts'
export type { ResolvePathOptions, Resolver } from './resolve.ts'
export { addServerHandler, addDevServerHandler, addServerPlugin, addPrerenderRoutes, useNitro, tryUseNitro, addServerImports, addServerImportsDir, addServerScanDir } from './nitro.ts'
export type { NitroCompatibilityVersion, NitroVersionOptions, NitroVersionedInput } from './nitro.ts'
export { createNitroHelpers } from './nitro-helpers.ts'
export type { NitroHelpers } from './nitro-helpers.ts'
export type { NitroInstance, NitroInstanceOptions } from '@nuxt/schema'
export type { NitroDevEventHandler, NitroDevEventHandlerV2, NitroDevEventHandlerV3, NitroEventHandler, NitroEventHandlerV2, NitroEventHandlerV3, NitroHandlerMethod, NitroRouteConfig } from './nitro-types.ts'
export { addTemplate, addServerTemplate, addTypeTemplate, normalizeTemplate, updateTemplates, writeTypes } from './template.ts'
export { packageName, resolveDeclarationPath, resolveTypePaths } from './types.ts'
export type { ResolveTypePathsOptions } from './types.ts'
export { recoverThrottledChanges } from './watch.ts'
export type { RecoverableWatcher } from './watch.ts'
export { logger, useLogger } from './logger.ts'
export { useTerminal } from './terminal.ts'
export type { NuxtTerminal, NuxtTerminalNotice, NuxtTerminalNotification, NuxtTerminalTask } from './terminal.ts'
export type { NuxtLogFn, NuxtLogInput, NuxtLogLevel, NuxtLogObject, NuxtLogReporter, NuxtLogType, NuxtLogger, NuxtLoggerOptions, NuxtPromptOptions } from './logger.ts'

// Dependencies
export { ensureDependencyInstalled, getAddDependencyCommand } from './dependency.ts'
export type { EnsureDependencyInstalledOptions } from './dependency.ts'

// Internal Utils
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { directoryToURL, resolveModule, tryResolveModule, importModule, tryImportModule, requireModule, tryRequireModule } from './internal/esm.ts'
export type { ImportModuleOptions, ResolveModuleOptions } from './internal/esm.ts'
