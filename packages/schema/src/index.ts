// Types
export type { NuxtCompatibility, NuxtCompatibilityIssue, NuxtCompatibilityIssues } from './types/compatibility.ts'
export type { Component, ComponentMeta, ComponentsDir, ComponentsOptions, ScanDir } from './types/components.ts'
export type { NuxtCompilerOptions, KeyedFunction, KeyedFunctionFactory, CompilerScanDir } from './types/compiler.ts'
export type { AppConfig, AppConfigInput, CustomAppConfig, DefineNuxtConfig, NuxtAppConfig, NuxtBuilder, NuxtConfig, NuxtConfigInput, NuxtOptions, PublicRuntimeConfig, RuntimeConfig, RuntimeValue, SchemaDefinition, UpperSnakeCase, ViteConfig, VitePlugin, ViteOptions, WebpackConfig, WebpackPluginInstance, ViewTransitionOptions, ViewTransitionPageOptions } from './types/config.ts'
export type { NuxtConfigLayer, NuxtConfigLayerMeta, NuxtDotenvOptions, NuxtLayerSourceOptions } from './types/layers.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type { ImportPresetWithDeprecation } from './types/hooks.ts'
export type { GenerateAppOptions, HookResult, ModuleInstallInfo, NuxtAnalyzeMeta, NuxtHookName, NuxtHooks, NuxtLayout, NuxtMiddleware, NuxtPage, NuxtPageMeta, TSReference, VueTSConfig, WatchEvent } from './types/hooks.ts'
export type { NuxtDeprecatedHook, NuxtHookCallback, NuxtHookKeys, NuxtHookRegistry, NuxtHookSpyEvent, NuxtNestedHooks } from './types/hookable.ts'
export type { NuxtManifest, NuxtManifestResource } from './types/manifest.ts'
export type { NuxtIgnoreMatcher, NuxtIgnoreOptions, NuxtIgnoreTestResult } from './types/ignore.ts'
export type { ImportsOptions, NuxtImport, NuxtImportAddonsOptions, NuxtImportCommon, NuxtImportDeclarationType, NuxtImportEntry, NuxtImportPreset, NuxtImportPresetName, NuxtImportPresetSource, NuxtImportScanDir, NuxtImportScanOptions, NuxtPackageImportPreset } from './types/imports.ts'
export type { AppHeadMetaObject, MetaObject, MetaObjectRaw } from './types/head.ts'
export type { ModuleDefinition, ModuleDependencies, ModuleDependencyMeta, ModuleMeta, ModuleOptions, ModuleSetupInstallResult, ModuleSetupReturn, NuxtModule, ResolvedModuleOptions } from './types/module.ts'
export type { Nuxt, NuxtApp, NuxtBuildOutputs, NuxtPlugin, NuxtPluginTemplate, NuxtTemplate, NuxtTemplateChange, NuxtTemplateDependency, NuxtTypeTemplate, NuxtServerTemplate, ResolvedNuxtTemplate } from './types/nuxt.ts'
export type { RouterConfig, RouterConfigSerializable, RouterOptions } from './types/router.ts'
export type { NitroInstance, NitroInstanceFallback, NitroInstanceOptions, NitroInstanceOptionsFallback, NitroTypes } from './types/nitro.ts'
export type { RequestEvent, RequestEventFallback, ServerRoutes, ServerTypes } from './types/server.ts'
export type { ConfigSchema } from './types/schema.ts'
export type { NuxtDebugContext, NuxtDebugOptions, NuxtDebugModuleMutationRecord } from './types/debug.ts'

// Schema
export { default as NuxtConfigSchema } from './config/index.ts'
