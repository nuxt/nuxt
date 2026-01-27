// Types
export type { NuxtCompatibility, NuxtCompatibilityIssue, NuxtCompatibilityIssues } from './types/compatibility.ts'
export type { Component, ComponentMeta, ComponentsDir, ComponentsOptions, ScanDir } from './types/components.ts'
export type { KeyedFunction } from './types/compiler.ts'
export type { AppConfig, AppConfigInput, CustomAppConfig, NuxtAppConfig, NuxtBuilder, NuxtConfig, NuxtConfigLayer, NuxtOptions, PublicRuntimeConfig, RuntimeConfig, RuntimeValue, SchemaDefinition, UpperSnakeCase, ViteConfig, ViteOptions } from './types/config.ts'
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type { ImportPresetWithDeprecation } from './types/hooks.ts'
export type { GenerateAppOptions, HookResult, NuxtAnalyzeMeta, NuxtHookName, NuxtHooks, NuxtLayout, NuxtMiddleware, NuxtPage, TSReference, VueTSConfig, WatchEvent } from './types/hooks.ts'
export type { ImportsOptions } from './types/imports.ts'
export type { AppHeadMetaObject, MetaObject, MetaObjectRaw } from './types/head.ts'
export type { ModuleAgentsConfig, ModuleAgentSkillsConfig, ModuleDefinition, ModuleDependencies, ModuleDependencyMeta, ModuleMeta, ModuleOptions, ModuleSetupInstallResult, ModuleSetupReturn, NuxtModule, ResolvedModuleOptions } from './types/module.ts'
export type { Nuxt, NuxtApp, NuxtPlugin, NuxtPluginTemplate, NuxtTemplate, NuxtTypeTemplate, NuxtServerTemplate, ResolvedNuxtTemplate } from './types/nuxt.ts'
export type { RouterConfig, RouterConfigSerializable, RouterOptions } from './types/router.ts'
export type { ConfigSchema } from './types/schema.ts'
export type { NuxtDebugContext, NuxtDebugOptions, NuxtDebugModuleMutationRecord } from './types/debug.ts'

// Schema
export { default as NuxtConfigSchema } from './config/index.ts'
