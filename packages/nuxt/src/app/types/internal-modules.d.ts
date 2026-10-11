/** Ambient (import-free) declarations for the `#internal/nuxt/*` virtuals Nuxt generates itself. */

declare module '#internal/nuxt/paths' {
  export const baseURL: () => string
  export const buildAssetsDir: () => string
  export const buildAssetsURL: (...path: string[]) => string
  export const publicAssetsURL: (...path: string[]) => string
}
