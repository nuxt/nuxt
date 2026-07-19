import { appDiagnostics } from '../../app/diagnostics/core'

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export interface ObjectFactory<T extends Function> {
  /**
   * The name of the factory function.
   * @example 'createUseFetch'
   */
  name: string
  factory: T
}

/**
 * Define a factory for a function that should be registered for automatic key injection.
 * @since 4.2.0
 * @param factory
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function defineKeyedFunctionFactory<T extends Function> (factory: ObjectFactory<T>): T {
  const placeholder = function () {
    throw appDiagnostics.NUXT_E1007({ name: factory.name })
  }

  return Object.defineProperty(placeholder, '__nuxt_factory', {
    enumerable: false,
    get: () => factory.factory,
  }) as unknown as T
}
