export interface NuxtCompatibility {
  /**
   * Required nuxt version in semver format.
   * @example `^2.14.0` or `>=3.0.0-27219851.6e49637`.
   */
  nuxt?: string

  /**
   * Bridge constraint for Nuxt 2 support.
   *
   * - `true`:  When using Nuxt 2, using bridge module is required.
   * - `false`: When using Nuxt 2, using bridge module is not supported.
   */
  bridge?: boolean

  /**
   * Mark a builder as incompatible, or require a particular version.
   *
   * @example
   * ```ts
   * export default defineNuxtModule({
   *   meta: {
   *     name: 'my-module',
   *     compatibility: {
   *       builder: {
   *         // marking as incompatible
   *         webpack: false,
   *         // you can require a (semver-compatible) version
   *         vite: '^5'
   *       }
   *     }
   *   }
   *   // ...
   * })
   * ```
   */
  builder?: Partial<Record<'vite' | 'webpack' | (string & {}), false | string>>
}

export interface NuxtCompatibilityIssue {
  name: string
  message: string
}

export interface NuxtCompatibilityIssues extends Array<NuxtCompatibilityIssue> {
  /**
   * Return formatted error message.
   */
  toString(): string
}
