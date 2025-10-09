import type { CompilerScanDir } from './compiler.ts'
import type { AugmentProperty, VueExtension } from '../utils/definition.ts'

export interface ComponentMeta {
  [key: string]: unknown
}

export interface Component {
  pascalName: string
  kebabName: string
  export: string
  filePath: string
  shortPath: string
  chunkName: string
  prefetch: boolean
  preload: boolean
  global?: boolean | 'sync'
  island?: boolean
  meta?: ComponentMeta
  mode?: 'client' | 'server' | 'all'
  /**
   * This number allows configuring the behavior of overriding Nuxt components.
   * If multiple components are provided with the same name, then higher priority
   * components will be used instead of lower priority components.
   */
  priority?: number
  /**
   * Path to component's declaration file
   * Used for type generation when different from filePath
   * @default filePath
   */
  declarationPath?: string
  /**
   * Allow bypassing client/server transforms for internal Nuxt components like
   * ServerPlaceholder and NuxtClientFallback.
   *
   * @internal
   */
  _raw?: boolean
}

// TODO: Move component-related properties to ComponentsDir

export interface ScanDir extends Omit<CompilerScanDir, 'extensions'> {
  /**
   * Prefix all matched components.
   */
  prefix?: string
  /**
   * Prefix component name by its path.
   */
  pathPrefix?: boolean
  /**
   * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by webpack via its magic comments.
   * Learn more on webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
   */
  prefetch?: boolean
  /**
   * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by webpack via its magic comments.
   * Learn more on webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
   */
  preload?: boolean
  /**
   * This flag indicates, component should be loaded async (with a separate chunk) regardless of using Lazy prefix or not.
   */
  isAsync?: boolean
  /**
   * Path to component's declaration file
   * Used for type generation when different from filePath
   */
  declarationPath?: string
  extendComponent?: (component: Component) => Promise<Component | void> | (Component | void)
  /**
   * If enabled, registers components to be globally available.
   *
   */
  global?: boolean
  /**
   * If enabled, registers components as islands
   */
  island?: boolean
}

export interface ComponentsDir extends ScanDir, AugmentProperty<Pick<CompilerScanDir, 'extensions'>, 'extensions', VueExtension> {
  /**
   * Watch specified path for changes, including file additions and file deletions.
   */
  watch?: boolean
  /**
   * Transpile specified path using build.transpile.
   * By default ('auto') it will set transpile: true if node_modules/ is in path.
   */
  transpile?: 'auto' | boolean
  /**
   * This number allows configuring the behavior of overriding Nuxt components.
   * It will be inherited by any components within the directory.
   *
   * If multiple components are provided with the same name, then higher priority
   * components will be used instead of lower priority components.
   */
  priority?: number
}

export interface ComponentsOptions {
  dirs: (string | ComponentsDir)[]
  /**
   * The default value for whether to globally register components.
   *
   * When components are registered globally, they will still be directly imported where used,
   * but they can also be used dynamically, for example `<component :is="`icon-${myIcon}`">`.
   *
   * This can be overridden by an individual component directory entry.
   */
  global?: boolean
  /**
   * Whether to write metadata to the build directory with information about the components that
   * are auto-registered in your app.
   */
  generateMetadata?: boolean
  loader?: boolean

  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }
}
