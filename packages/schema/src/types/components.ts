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
  mode?: 'client' | 'server' | 'all'
  /**
   * This number allows configuring the behavior of overriding Nuxt components.
   * If multiple components are provided with the same name, then higher priority
   * components will be used instead of lower priority components.
   */
  priority?: number
  /**
   * Allow bypassing client/server transforms for internal Nuxt components like
   * ServerPlaceholder and NuxtClientFallback.
   *
   * @internal
   */
  _raw?: boolean
}

export interface ScanDir {
  /**
   * Path (absolute or relative) to the directory containing your components.
   * You can use Nuxt aliases (~ or @) to refer to directories inside project or directly use an npm package path similar to require.
   */
  path: string
  /**
   * Accept Pattern that will be run against specified path.
   */
  pattern?: string | string[]
  /**
   * Ignore patterns that will be run against specified path.
   */
  ignore?: string[]
  /**
   * Prefix all matched components.
   */
  prefix?: string
  /**
   * Prefix component name by its path.
   */
  pathPrefix?: boolean
  /**
   * Ignore scanning this directory if set to `true`
   */
  enabled?: boolean
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

export interface ComponentsDir extends ScanDir {
  /**
   * Watch specified path for changes, including file additions and file deletions.
   */
  watch?: boolean
  /**
   * Extensions supported by Nuxt builder.
   */
  extensions?: string[]
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
   *
   * @default false
   */
  global?: boolean
  loader?: boolean

  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }
}
