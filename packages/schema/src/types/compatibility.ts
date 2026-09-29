import type { ServerApi } from './nitro.ts'

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
   * nitro does not satisfy the range. It says nothing about which server API the module's
   * runtime code uses; see `server` for that.
   * @example `>=2.0.0` or `^3.0.0`.
   */
  nitro?: string

  /**
   * The server API the module's runtime code is written against, for every server
   * registration the module makes and every file under its runtime directories.
   *
   * Usually unnecessary: a file's imports say which API it uses (`nuxt/server`, `nitro/*`
   * or `h3`/`nitropack`). Undeclared and uninferrable code is treated as `nitro2`.
   */
  server?: ServerApi

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
