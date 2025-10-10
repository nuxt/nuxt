export interface KeyedFunction {
  /**
   * The name of the function.
   */
  name: string
  // TODO: make required in Nuxt 5
  /**
   * The path to the file where the function is defined.
   * You can use Nuxt aliases (~ or @) to refer to directories inside the project or directly use an npm package path similar to require.
   */
  source?: string
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
