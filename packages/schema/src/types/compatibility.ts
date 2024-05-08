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
  bridge?: boolean,

  /**
   * Required using a compatible builder.
   *
   * - `vite`: compatible with `@nuxt/vite-builder` only
   * - `webpack`: compatible with `@nuxt/webpack-builder` only
   * - `all`: compatible with all builders
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
