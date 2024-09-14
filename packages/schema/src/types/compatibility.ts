export interface NuxtCompatibility {
  /**
   * Required nuxt version in semver format.
   * @example `^3.2.0` or `>=3.13.0`.
   */
  nuxt?: string

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
