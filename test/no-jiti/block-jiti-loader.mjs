/**
 * Module customisation hook that makes any attempt to load `jiti` from Nuxt's own code fail
 * loudly.
 *
 * `jiti` is present in this repository's `node_modules` as a transitive dependency, so its
 * absence cannot be asserted by installation alone. Registering this hook in a child process is
 * what lets the tests prove that a default project never reaches for it.
 *
 * `nitropack` and the copy of `c12` it loads import `jiti` themselves, and that is outside Nuxt's
 * control, so requests coming from inside them are allowed through.
 */
const ALLOWED_IMPORTERS = [/[/\\]nitropack[/\\]/, /[/\\]c12[/\\]/]

export function resolve (specifier, context, next) {
  const isJiti = specifier === 'jiti' || /[/\\]jiti[/\\]/.test(specifier)
  const allowed = context.parentURL && ALLOWED_IMPORTERS.some(re => re.test(context.parentURL))
  if (isJiti && !allowed) {
    throw new Error(`jiti was requested (${specifier}) from ${context.parentURL}`)
  }
  return next(specifier, context)
}
