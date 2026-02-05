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
    if (!import.meta.dev) { return }
    throw new Error(
      `[nuxt:compiler] \`${factory.name}\` is a compiler macro that is only usable inside ` +
      // TODO: add link to docs about this factory function
      'the directories scanned by the Nuxt compiler as an exported function and imported statically. Learn more: `https://nuxt.com/docs/TODO`',
    )
  }

  return Object.defineProperty(placeholder, '__nuxt_factory', {
    enumerable: false,
    get: () => factory.factory,
  }) as unknown as T
}
