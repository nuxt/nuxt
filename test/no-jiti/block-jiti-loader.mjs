/**
 * Module customisation hook that makes any attempt to load `jiti` fail loudly.
 *
 * `jiti` is an optional peer dependency of `@nuxt/kit` and `nuxt`, and it is present in this
 * repository's `node_modules` as a transitive dependency, so its absence cannot be asserted by
 * installation alone. Registering this hook in a child process is what lets the tests prove that
 * a default project never reaches for it.
 */
export function resolve (specifier, context, next) {
  if (specifier === 'jiti' || /[/\\]jiti[/\\]/.test(specifier)) {
    throw new Error(`jiti was requested (${specifier})`)
  }
  return next(specifier, context)
}
