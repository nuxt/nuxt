// Module
export { defineNuxtModule } from './module/define.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getDirectory, installModule, installModules, loadNuxtModuleInstance, normalizeModuleTranspilePath, resolveModuleWithOptions } from './module/install.ts'
export { getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility } from './module/compatibility.ts'

// Loader
export { loadNuxtConfig } from './loader/config.ts'
export type { LoadNuxtConfigOptions } from './loader/config.ts'
export { extendNuxtSchema } from './loader/schema.ts'
export { buildNuxt, loadNuxt } from './loader/nuxt.ts'
export type { LoadNuxtOptions } from './loader/nuxt.ts'

// Layers
export { getLayerDirectories } from './layers.ts'
export type { LayerDirectories } from './layers.ts'

// Utils
export { setGlobalHead } from './head.ts'
export { addImports, addImportsDir, addImportsSources } from './imports.ts'
export { updateRuntimeConfig, useRuntimeConfig } from './runtime-config.ts'
export { addBuildPlugin, addVitePlugin, addRspackPlugin, addWebpackPlugin, extendViteConfig, extendRspackConfig, extendWebpackConfig } from './build.ts'
export type { ExtendConfigOptions, ExtendViteConfigOptions, ExtendWebpackConfigOptions } from './build.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { assertNuxtCompatibility, checkNuxtCompatibility, getNuxtVersion, hasNuxtCompatibility, isNuxtMajorVersion, normalizeSemanticVersion, isNuxt2, isNuxt3 } from './compatibility.ts'
export type { NuxtMajorVersion } from './compatibility.ts'
export { addComponent, addComponentExports, addComponentsDir } from './components.ts'
export type { AddComponentOptions } from './components.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { getNuxtCtx, runWithNuxtContext, tryUseNuxt, useNuxt, nuxtCtx } from './context.ts'
export { createIsIgnored, isIgnored, resolveIgnorePatterns } from './ignore.ts'
export { addLayout } from './layout.ts'
export { addRouteMiddleware, extendPages, extendRouteRules } from './pages.ts'
export type { AddRouteMiddlewareOptions, ExtendRouteRulesOptions } from './pages.ts'
export { addPlugin, addPluginTemplate, normalizePlugin } from './plugin.ts'
export type { AddPluginOptions } from './plugin.ts'
export { createResolver, findPath, resolveAlias, resolveFiles, resolveNuxtModule, resolvePath } from './resolve.ts'
export type { ResolvePathOptions, Resolver } from './resolve.ts'
export { addServerHandler, addDevServerHandler, addServerPlugin, addPrerenderRoutes, useNitro, addServerImports, addServerImportsDir, addServerScanDir } from './nitro.ts'
export { addTemplate, addServerTemplate, addTypeTemplate, normalizeTemplate, updateTemplates, writeTypes } from './template.ts'
export { logger, useLogger } from './logger.ts'

// Internal Utils
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { directoryToURL, resolveModule, tryResolveModule, importModule, tryImportModule, requireModule, tryRequireModule } from './internal/esm.ts'
export type { ImportModuleOptions, ResolveModuleOptions } from './internal/esm.ts'
