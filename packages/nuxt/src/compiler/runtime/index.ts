import { runtimeErrorUtils } from '../../app/utils'
import { E1007 } from '../../app/error-codes'

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
    runtimeErrorUtils.throw(
      `\`${factory.name}\` is a compiler macro and cannot be called at runtime.`,
      { code: E1007, fix: 'It is only usable inside the directories scanned by the Nuxt compiler as an exported function and imported statically.' },
    )
  }

  return Object.defineProperty(placeholder, '__nuxt_factory', {
    enumerable: false,
    get: () => factory.factory,
  }) as unknown as T
}
