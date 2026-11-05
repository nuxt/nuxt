/**
 * The `crossorigin` attribute value for static assets, configured via `app.crossOrigin`.
 *
 * `''` renders a bare `crossorigin` attribute (equivalent to `anonymous`) and is the default,
 * preserving the current behaviour. `'use-credentials'` makes the browser include credentials
 * (such as cookies) when fetching assets from another origin, for example a CDN.
 */
export type AssetCrossOrigin = '' | 'anonymous' | 'use-credentials'

/** Read the configured `crossorigin` value for build assets from runtime config, falling back to the default when unset or invalid. */
export function getAssetCrossOrigin (runtimeConfig?: { app?: { crossOrigin?: unknown } }): AssetCrossOrigin {
  const value = runtimeConfig?.app?.crossOrigin
  return value === 'anonymous' || value === 'use-credentials' ? value : ''
}

/**
 * Apply the configured `crossorigin` to a resource-hint link that already carries one
 * (for example, one from `vue-bundle-renderer`, which hardcodes a bare attribute).
 * Links without a `crossorigin` are returned unchanged.
 */
export function withAssetCrossOrigin<T extends { crossorigin?: string | null }> (link: T, crossOrigin: AssetCrossOrigin): T {
  if (!crossOrigin || link.crossorigin == null) {
    return link
  }
  return { ...link, crossorigin: crossOrigin }
}

/**
 * Apply the configured `crossorigin` to a `Link` header value (for example, 103 Early Hints
 * from `vue-bundle-renderer`), replacing bare `; crossorigin` segments with the configured value.
 */
export function applyCrossOriginToLinkHeader (linkHeader: string, crossOrigin: AssetCrossOrigin): string {
  if (!crossOrigin) {
    return linkHeader
  }
  return linkHeader.replace(/; crossorigin(?=,|$)/g, `; crossorigin="${crossOrigin}"`)
}

/** Render the `crossorigin` attribute for a manually-built tag string. */
export function crossOriginAttribute (crossOrigin: AssetCrossOrigin): string {
  return crossOrigin ? ` crossorigin="${crossOrigin}"` : ' crossorigin'
}
