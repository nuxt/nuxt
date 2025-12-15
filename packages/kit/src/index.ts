// Module
export { defineNuxtModule } from './module/define'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getDirectory, installModule, installModules, loadNuxtModuleInstance, normalizeModuleTranspilePath, resolveModuleWithOptions } from './module/install'
export { getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility } from './module/compatibility'

// Loader
export { loadNuxtConfig } from './loader/config'
export type { LoadNuxtConfigOptions } from './loader/config'
export { extendNuxtSchema } from './loader/schema'
export { buildNuxt, loadNuxt } from './loader/nuxt'
export type { LoadNuxtOptions } from './loader/nuxt'

// Layers
export { getLayerDirectories } from './layers'
export type { LayerDirectories } from './layers'

// Utils
export { setGlobalHead } from './head'
export { addImports, addImportsDir, addImportsSources } from './imports'
export { updateRuntimeConfig, useRuntimeConfig } from './runtime-config'
export { addBuildPlugin, addVitePlugin, addRspackPlugin, addWebpackPlugin, extendViteConfig, extendRspackConfig, extendWebpackConfig } from './build'
export type { ExtendConfigOptions, ExtendViteConfigOptions, ExtendWebpackConfigOptions } from './build'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { assertNuxtCompatibility, checkNuxtCompatibility, getNuxtVersion, hasNuxtCompatibility, isNuxtMajorVersion, normalizeSemanticVersion, isNuxt2, isNuxt3 } from './compatibility'
export type { NuxtMajorVersion } from './compatibility'
export { addComponent, addComponentExports, addComponentsDir } from './components'
export type { AddComponentOptions } from './components'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getNuxtCtx, runWithNuxtContext, tryUseNuxt, useNuxt, nuxtCtx } from './context'
export { createIsIgnored, isIgnored, resolveIgnorePatterns } from './ignore'
export { addLayout } from './layout'
export { addRouteMiddleware, extendPages, extendRouteRules } from './pages'
export type { AddRouteMiddlewareOptions, ExtendRouteRulesOptions } from './pages'
export { addPlugin, addPluginTemplate, normalizePlugin } from './plugin'
export type { AddPluginOptions } from './plugin'
export { createResolver, findPath, resolveAlias, resolveFiles, resolveNuxtModule, resolvePath } from './resolve'
export type { ResolvePathOptions, Resolver } from './resolve'
export { addServerHandler, addDevServerHandler, addServerPlugin, addPrerenderRoutes, useNitro, addServerImports, addServerImportsDir, addServerScanDir } from './nitro'
export { addTemplate, addServerTemplate, addTypeTemplate, normalizeTemplate, updateTemplates, writeTypes } from './template'
export { logger, useLogger } from './logger'

// Internal Utils
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { directoryToURL, resolveModule, tryResolveModule, importModule, tryImportModule, requireModule, tryRequireModule } from './internal/esm'
export type { ImportModuleOptions, ResolveModuleOptions } from './internal/esm'
export * from './internal/template'
