import { useRuntimeConfig } from '../nuxt';

/**
 * Returns a function that allows to ensure given route path respects Nuxt's `baseURL` option.
 * If provided path already has a `baseURL` prefix or is not an absolute path, it will be returned as is.
 */
export function useMaybeAbsolutePath() {
  const runtimeConfig = useRuntimeConfig()
  return (path: string) => {
    const baseURL = runtimeConfig.app.baseURL
    if (path.startsWith(baseURL))
      return path
    else if (path.startsWith('/'))
      return baseURL + path.substring(1)
    else
      return path
  }
}