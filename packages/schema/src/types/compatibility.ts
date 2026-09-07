export interface NuxtCompatibility {
  /**
   * Required nuxt version in semver format.
   * @example `^3.2.0` or `>=3.13.0`.
   */
  nuxt?: string

  /**
   * Required nitro version in semver format.
   *
   * Like `nuxt`, this is a requirement check only: the module is disabled when the host
   * nitro does not satisfy the range. It does not change how the module's server
   * registrations are versioned; pass `version` to kit helpers such as
   * `addServerHandler` (or use `createNitroHelpers()`) for that.
   * @example `>=2.0.0` or `^3.0.0`.
   */
  nitro?: string

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
  builder?: Partial<Record<'vite' | 'webpack' | 'rspack' | (string & {}), false | string>>
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
