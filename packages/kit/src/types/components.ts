export interface Component {
  pascalName: string
  kebabName: string
  export: string
  filePath: string
  shortPath: string
  chunkName: string
  level: number
  prefetch: boolean
  preload: boolean
  global?: boolean

  /** @deprecated */
  import?: string
  /** @deprecated */
  asyncImport?: string
  /** @deprecated */
  async?: boolean
}

export interface ScanDir {
  /**
   * Path (absolute or relative) to the directory containing your components.
   * You can use Nuxt aliases (~ or @) to refer to directories inside project or directly use a npm package path similar to require.
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
   * Prefix component name by it's path.
   */
  pathPrefix?: boolean
  /**
   * Level is used to define a hint when overwriting the components which have the same name in two different directories.
   */
  level?: number
  /**
   * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by Wepack via its magic comments.
   * Learn more on Webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
   */
  prefetch?: boolean
  /**
   * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by Wepack via its magic comments.
   * Learn more on Webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
   */
  preload?: boolean
  /**
   * This flag indicates, component should be loaded async (with a seperate chunk) regardless of using Lazy prefix or not.
   */
  isAsync?: boolean

  extendComponent?: (component: Component) => Promise<Component | void> | (Component | void)

  /**
   * If enabled, registers components to be globally available
   *
   */
  global?: boolean
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
}

export interface ComponentsOptions {
  dirs: (string | ComponentsDir)[]
  loader: Boolean
}
