import type {
  AppConfig as _AppConfig,
  ConfigSchema as _ConfigSchema,
  CustomAppConfig as _CustomAppConfig,
  ModuleDependencies as _ModuleDependencies,
  NuxtConfig as _NuxtConfig,
  NuxtDebugOptions as _NuxtDebugOptions,
  NuxtHooks as _NuxtHooks,
  NuxtOptions as _NuxtOptions,
  NuxtPage as _NuxtPage,
  ViteOptions as _ViteOptions,
} from '@nuxt/schema'

export * from '@nuxt/schema'

// Bridge augmentations to `@nuxt/schema` into `nuxt/schema`'s module identity so
// that users and modules only need to augment one of the two surfaces.
declare module 'nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NuxtHooks extends _NuxtHooks {}
  interface NuxtConfig extends _NuxtConfig { hooks?: Partial<NuxtHooks> }
  interface NuxtOptions extends _NuxtOptions { hooks: NuxtHooks }
  interface ConfigSchema extends _ConfigSchema { hooks: NuxtHooks }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppConfig extends _AppConfig {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CustomAppConfig extends _CustomAppConfig {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ModuleDependencies extends _ModuleDependencies {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NuxtPage extends _NuxtPage {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NuxtDebugOptions extends _NuxtDebugOptions {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ViteOptions extends _ViteOptions {}
}
