import type { NuxtConfig, NuxtOptions, DefineNuxtConfig as _DefineNuxtConfig } from 'nuxt/schema'

export { NuxtConfig } from 'nuxt/schema'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DefineNuxtConfig extends _DefineNuxtConfig<NuxtConfig> {}

export declare const defineNuxtConfig: DefineNuxtConfig

/**
 * Resolve a merged `nuxt.config` into `nuxt.options`.
 * @internal
 */
export declare function resolveNuxtOptions (config: NuxtConfig): NuxtOptions

/**
 * Resolve the directories of a layer's config, leaving its other keys as they are.
 * @internal
 */
export declare function resolveLayerOptions<T extends NuxtConfig> (config: T): T & Pick<NuxtOptions, 'rootDir' | 'srcDir' | 'serverDir' | 'dir'>

/**
 * Render the loading page shown while the dev server starts.
 * @internal
 */
export declare function loadingTemplate (messages: Partial<Record<'appName' | 'loading', string | boolean | number>>): string
