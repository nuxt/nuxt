import type { JavascriptExtension } from '../utils/definition.ts'
import type { ScanPlugin } from './nuxt.ts'

export interface KeyedFunction {
  /**
   * The name of the function.
   *
   * Use 'default' to target a module's default export. In that case, the callable name
   * is derived from the filename (camel-cased) for matching during analysis.
   */
  name: string
  /**
   * The path to the file where the function is defined.
   * You can use Nuxt aliases (~ or @) to refer to directories inside the project or directly use an npm package path similar to require.
   */
  source: string
  /**
   * The maximum number of arguments the function can accept.
   * In the case that the function is called with fewer arguments than this number,
   * the compiler will inject an auto-generated key as an additional argument.
   *
   * The key is unique based on the location of the function being invoked within the file.
   *
   * @example `{ name: 'useKey', source: '~/composables/useKey', argumentLength: 2 }`
   *
   * ```ts
   * useKey()                  // will be transformed to: useKey('\$KzLSZ0O59L')
   * useKey('first')           // will be transformed to: useKey('first', '\$KzLSZ0O59L')
   * useKey('first', 'second') // will not be transformed
   * ```
   */
  argumentLength: number
}

export interface KeyedFunctionFactory extends Pick<KeyedFunction, 'argumentLength'> {
  /**
   * The name of the factory function.
   * @example 'createUseFetch'
   */
  name: string
  source: string
}

export interface NuxtCompilerOptions {
  /**
   * Enable scanning of directories for Nuxt compiler transformations.
   */
  scan?: boolean
  /**
   * The directories to scan for files.
   */
  dirs?: (string | CompilerScanDir)[]
  /**
   * An array of nuxt compiler plugins.
   * These plugins are run before the build transformations to allow for preprocessing of files.
   *
   * All plugins are deduplicated by their `name` property.
   */
  plugins?: ScanPlugin[]
}

export interface CompilerScanDir {
  /**
   * Path (absolute or relative) to the directory to scan for files.
   * Relative paths are resolved against the Nuxt source directory of the project.
   *
   * You can use Nuxt aliases (~ or @) to refer to directories inside the project or directly use an NPM package path similar to `require()`.
   */
  path: string
  /**
   * The file extensions to scan in the specified path.
   *
   * This has no effect if `pattern` is specified.
   */
  extensions?: (JavascriptExtension | (string & {}))[]
  /**
   * Accept Pattern that will be run against the specified path.
   */
  pattern?: string | string[]
  /**
   * Ignore patterns that will be run against the specified path.
   */
  ignore?: string[]
}
