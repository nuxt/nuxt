import { MatcherPatternPathDynamic } from 'vue-router/experimental'
import type { EmptyParams, MatcherPatternPath, MatcherPatternPathDynamic_ParamOptions } from 'vue-router/experimental'

import routerOptions from '#build/router.options.mjs'

const TRAILING_SLASH_RE = /\/$/

const withoutTrailingSlash = (path: string) => path.length > 1 ? path.replace(TRAILING_SLASH_RE, '') : path

/** Matches a static path as the classic router does: a trailing slash is optional, and `sensitive` sets the case. */
export class StaticPathMatcher implements MatcherPatternPath<EmptyParams> {
  private readonly key: string
  constructor (readonly path: string) {
    this.key = routerOptions.sensitive ? path : path.toLowerCase()
  }

  match (path: string): EmptyParams | null {
    path = withoutTrailingSlash(path)
    return (routerOptions.sensitive ? path : path.toLowerCase()) === this.key ? {} : null
  }

  build (): string {
    return this.path
  }
}

/**
 * Matches a dynamic path with the regexp of the classic router, which decides about a trailing
 * slash, and builds paths without one as the classic router does.
 */
export class DynamicPathMatcher<T> extends MatcherPatternPathDynamic<T> {
  constructor (re: RegExp, params: T & Record<string, MatcherPatternPathDynamic_ParamOptions<any, any>>, pathParts: Array<string | number | Array<string | number>>) {
    super(re, params, pathParts, null)
  }

  override build (params: Parameters<MatcherPatternPathDynamic<T>['build']>[0]): string {
    return withoutTrailingSlash(super.build(params))
  }
}
