// The `#builder` indirection mirrors `@nuxt/webpack-builder` / `@nuxt/rspack-builder`,
// where a single codebase targets one of several interchangeable bundler cores. Here it
// re-exports the Nasti core (Rolldown-based) and tags the active builder as `nasti`, so
// the rest of the package imports its bundler surface from one place.
export const builder = 'nasti'
export * from '@nasti-toolchain/nasti'
