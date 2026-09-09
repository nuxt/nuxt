/**
 * CORS mode for SSR-rendered build-asset tags. Matches the HTML `crossorigin` attribute.
 */
export type BuildAssetsCrossOrigin = '' | 'anonymous' | 'use-credentials'

/**
 * Rewrite vue-bundle-renderer resource hints that currently use anonymous CORS
 * so they match the configured {@link BuildAssetsCrossOrigin}.
 *
 * Hints with `crossorigin: null` (no CORS) are left unchanged.
 */
export function applyBuildAssetsCrossOrigin<T extends { crossorigin?: string | null }> (
  links: Iterable<T>,
  value: BuildAssetsCrossOrigin,
): T[] {
  const result: T[] = []
  for (const link of links) {
    if (value && (link.crossorigin === '' || link.crossorigin === 'anonymous')) {
      result.push({ ...link, crossorigin: value })
    } else {
      result.push(link)
    }
  }
  return result
}

/** HTML attribute fragment for tags interpolated outside unhead (streaming stylesheets). */
export function buildAssetsCrossoriginHtmlAttr (value: BuildAssetsCrossOrigin): string {
  return value ? ` crossorigin="${value}"` : ' crossorigin'
}

/** Rewrite `crossorigin` tokens on HTTP `Link` headers from vue-bundle-renderer. */
export function applyBuildAssetsCrossOriginHeader (header: string, value: BuildAssetsCrossOrigin): string {
  if (!value) {
    return header
  }
  return header.replaceAll('; crossorigin', `; crossorigin="${value}"`)
}
