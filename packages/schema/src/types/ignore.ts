/** Options for the gitignore-style matcher Nuxt uses to ignore files. */
export interface NuxtIgnoreOptions {
  /** Match patterns case-insensitively. */
  ignorecase?: boolean
  /** Alias of `ignorecase`. */
  ignoreCase?: boolean
  /** Allow paths that are not relative to the project root to be tested. */
  allowRelativePaths?: boolean
}

/** The result of testing a path against the ignore rules. */
export interface NuxtIgnoreTestResult {
  ignored: boolean
  unignored: boolean
  rule?: unknown
}

/**
 * A compiled set of gitignore-style rules, built from `.nuxtignore`, `.gitignore` and the
 * `ignore` option.
 */
export interface NuxtIgnoreMatcher {
  /**
   * Add one or more patterns to the matcher.
   *
   * Declared with method syntax so implementations may accept a wider set of inputs.
   */
  add(patterns: string | readonly string[]): NuxtIgnoreMatcher
  /** Whether the given project-relative path should be ignored. */
  ignores: (pathname: string) => boolean
  /** Filter project-relative paths, keeping those that are not ignored. */
  filter: (pathnames: readonly string[]) => string[]
  /** Create a predicate suitable for `Array.prototype.filter`. */
  createFilter: () => (pathname: string) => boolean
  /** Test a path, reporting whether a rule ignored or explicitly unignored it. */
  test: (pathname: string) => NuxtIgnoreTestResult
}
