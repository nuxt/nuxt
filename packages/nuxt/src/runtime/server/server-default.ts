/**
 * The web-standard implementations backing `nuxt/server`, under a specifier a
 * server bundle does not redirect.
 *
 * A builder that supplies `serverBuild.runtime.server` resolves `nuxt/server`
 * to its own module, so this is how it reaches the shipped implementations for
 * the parts it has nothing to add to.
 */
export * from '../../server/index'
