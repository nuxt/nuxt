// Types
export type { NuxtCompatibility, NuxtCompatibilityIssue, NuxtCompatibilityIssues } from './types/compatibility'
export type { Component, ComponentMeta, ComponentsDir, ComponentsOptions, ScanDir } from './types/components'
export type { AppConfig, AppConfigInput, CustomAppConfig, NuxtAppConfig, NuxtBuilder, NuxtConfig, NuxtConfigLayer, NuxtOptions, PublicRuntimeConfig, RuntimeConfig, RuntimeValue, SchemaDefinition, UpperSnakeCase, ViteConfig } from './types/config'
export type { GenerateAppOptions, HookResult, ImportPresetWithDeprecation, NuxtAnalyzeMeta, NuxtHookName, NuxtHooks, NuxtLayout, NuxtMiddleware, NuxtPage, TSReference, VueTSConfig, WatchEvent } from './types/hooks'
export type { ImportsOptions } from './types/imports'
export type { AppHeadMetaObject, MetaObject, MetaObjectRaw, HeadAugmentations } from './types/head'
export type { ModuleDefinition, ModuleMeta, ModuleOptions, ModuleSetupReturn, ModuleSetupInstallResult, NuxtModule, ResolvedModuleOptions } from './types/module'
export type { Nuxt, NuxtApp, NuxtPlugin, NuxtPluginTemplate, NuxtTemplate, NuxtTypeTemplate, NuxtServerTemplate, ResolvedNuxtTemplate } from './types/nuxt'
export type { RouterConfig, RouterConfigSerializable, RouterOptions } from './types/router'

// Schema
export { default as NuxtConfigSchema } from './config/index'
