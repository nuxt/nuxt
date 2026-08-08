/**
 * Return the `default` export of a module namespace, with the module's other named exports
 * grafted onto it, so consumers can use a CJS-transpiled module as if it were ESM.
 */
export function interopDefault<T> (sourceModule: T, opts: { preferNamespace?: boolean } = {}): T {
  if (sourceModule === null || typeof sourceModule !== 'object' || !('default' in sourceModule)) {
    return sourceModule
  }

  const defaultValue = sourceModule.default
  if (defaultValue === undefined || defaultValue === null) {
    return sourceModule
  }

  const defaultType = typeof defaultValue
  if (defaultType !== 'object' && !(defaultType === 'function' && !opts.preferNamespace)) {
    return opts.preferNamespace ? sourceModule : defaultValue as T
  }

  for (const key in sourceModule) {
    try {
      if (!(key in (defaultValue as object))) {
        Object.defineProperty(defaultValue, key, {
          enumerable: key !== 'default',
          configurable: key !== 'default',
          get () {
            return sourceModule[key as keyof T]
          },
        })
      }
    } catch {
      // a non-configurable or frozen default export cannot be augmented
    }
  }

  return defaultValue as T
}
