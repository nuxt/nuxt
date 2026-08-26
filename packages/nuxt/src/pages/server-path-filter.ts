import { readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { relative, resolve } from 'pathe'
import { joinURL, withLeadingSlash, withTrailingSlash, withoutBase } from 'ufo'
import type { NitroEventHandler } from 'nitro/types'

/**
 * Bloom filter over the paths the server answers itself, so a client-side navigation that
 * matches no page route can tell "probably served, ask the server" from "certainly a 404". A
 * false positive costs one document load that still ends on the error page.
 *
 * A server route with a parameter (`/og/:slug`) is stored as its shape, with the parameter
 * replaced by {@link PARAM}, and a lookup tests every shape the path could have. Membership is
 * the only thing shipped, so a route is never described to the client.
 */

/** A route parameter (`:slug`), in a shape. Cannot appear in a path. */
const PARAM = '\u0001'
/** The rest of the path, after a route wildcard (`**`), in a shape. */
const REST = '\u0002'

/** A path is tested once, so ~1% false positives costs 9.6 bits and 7 hashes per entry. */
const PATH_BITS_PER_ENTRY = 9.6
const PATH_HASH_COUNT = 7

/**
 * A lookup tests up to `2 ** (MAX_SHAPE_DEPTH + 1)` shapes, and each is an independent chance
 * of a false positive, so the per-shape rate has to be far lower: 24 bits and 17 hashes per
 * entry puts it at ~1 in 130,000. Only routes with a parameter are in this filter, and an app
 * has far fewer of those than files, so the bits are cheap here.
 */
const SHAPE_BITS_PER_ENTRY = 24
const SHAPE_HASH_COUNT = 17
/** Beyond this depth only the path itself and its wildcard prefixes are tested. */
const MAX_SHAPE_DEPTH = 8

/**
 * The bit positions a path occupies in a filter of `bitCount` bits.
 *
 * This is emitted verbatim into the client with `Function.prototype.toString()`, so it must
 * stay self-contained: no imports, no module-scope references.
 */
export function serverPathFilterLocations (path: string, hashCount: number, bitCount: number): number[] {
  let h1 = 2166136261
  let h2 = 5381
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619)
    h2 = Math.imul(h2, 33) ^ c
  }
  h1 >>>= 0
  h2 = (h2 >>> 0) | 1
  const locations = []
  for (let i = 0; i < hashCount; i++) {
    locations.push(((h1 + Math.imul(i, h2)) >>> 0) % bitCount)
  }
  return locations
}

export interface BloomFilter {
  entries: number
  bitCount: number
  hashCount: number
  bits: Uint8Array
}

function createBloomFilter (values: Iterable<string>, bitsPerEntry: number, hashCount: number): BloomFilter {
  const unique = new Set(values)
  const bitCount = Math.max(8, Math.ceil(unique.size * bitsPerEntry))
  const bits = new Uint8Array(Math.ceil(bitCount / 8))
  for (const value of unique) {
    for (const n of serverPathFilterLocations(value, hashCount, bitCount)) {
      bits[n >> 3]! |= 1 << (n & 7)
    }
  }
  return { entries: unique.size, bitCount, hashCount, bits }
}

/**
 * Paths and route shapes are separate filters, because a path is tested once per lookup and a
 * shape up to `2 ** (MAX_SHAPE_DEPTH + 1)` times. Sharing one filter would mean paying the
 * shapes' bit budget on every file in `public/`.
 */
export interface ServerPathFilter {
  paths: BloomFilter
  shapes: BloomFilter
}

export function createServerPathFilter (paths: Iterable<string>, shapes: Iterable<string> = []): ServerPathFilter {
  return {
    paths: createBloomFilter(paths, PATH_BITS_PER_ENTRY, PATH_HASH_COUNT),
    shapes: createBloomFilter(shapes, SHAPE_BITS_PER_ENTRY, SHAPE_HASH_COUNT),
  }
}

export interface PublicAssetDir {
  dir: string
  baseURL?: string
}

/**
 * Every path nitro serves as a static file that an app could navigate to, as the router sees
 * it: leading slash, per-asset `baseURL` applied, app `baseURL` removed (it is applied again
 * by `router.resolve()`, and can be overridden at runtime through `NUXT_APP_BASE_URL`).
 */
export function collectPublicAssetPaths (publicAssets: PublicAssetDir[], options: { clientBuildDir: string, buildAssetsDir: string, baseURL: string }): Set<string> {
  const paths = new Set<string>()
  const clientBuildDir = resolve(options.clientBuildDir)
  const buildAssetsDir = withTrailingSlash(withLeadingSlash(withoutBase(options.buildAssetsDir, options.baseURL)))
  for (const asset of publicAssets) {
    const dir = resolve(asset.dir)
    if (dir === clientBuildDir || dir.startsWith(clientBuildDir + '/')) { continue }
    const assetBase = withTrailingSlash(withLeadingSlash(withoutBase(asset.baseURL || '/', options.baseURL)))
    // build assets and the app manifest are never navigated to
    if (assetBase.startsWith(buildAssetsDir)) { continue }
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) { continue }
      const file = relative(dir, resolve(entry.parentPath, entry.name))
      paths.add(withLeadingSlash(withoutBase(joinURL(asset.baseURL || '/', file), options.baseURL)))
    }
  }
  return paths
}

/**
 * The shape of a route: itself when it is static, and otherwise with each parameter segment
 * replaced by {@link PARAM} and everything from a wildcard segment on by {@link REST}.
 */
function toRouteShape (route: string): string {
  const segments = route.split('/')
  let shape = ''
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]!
    if (segment.startsWith('*')) { return shape + '/' + REST }
    shape += '/' + (segment.startsWith(':') ? PARAM : segment)
  }
  return shape
}

/**
 * The server routes a `GET` navigation could reach: `server/routes/**` and `server/api/**`
 * handlers with no method suffix or a `.get` one, as the router sees them. Static routes are
 * returned as `paths` and the rest as `shapes`.
 *
 * A root-level catch-all (`/**`, as used by the Nuxt renderer itself and by middleware) covers
 * every path, so it is ignored: it would make the filter match everything.
 */
export function collectServerRoutes (handlers: NitroEventHandler[], options: { baseURL: string }): { paths: Set<string>, shapes: Set<string> } {
  const paths = new Set<string>()
  const shapes = new Set<string>()
  for (const handler of handlers) {
    if (handler.middleware || !handler.route || handler.route === '/**') { continue }
    if (handler.method && handler.method.toLowerCase() !== 'get') { continue }
    const route = withLeadingSlash(withoutBase(handler.route, options.baseURL))
    const shape = toRouteShape(route)
    if (shape === route) {
      paths.add(route)
    } else {
      shapes.add(shape)
    }
  }
  return { paths, shapes }
}

/**
 * `#build/server-path-filter.mjs`.
 *
 * `serverPathFallback` is a literal so a disabled build drops the import, the filter data and
 * the lookup. `undefined` means enabled with a path list that cannot be trusted (dev) and
 * matches everything.
 */
export function renderServerPathFilterModule (filter: ServerPathFilter | undefined | false): string {
  // nothing to fall back to, so nothing is shipped
  if (filter === false || (filter && !filter.paths.entries && !filter.shapes.entries)) {
    return [
      'export const serverPathFallback = false',
      'export const mightBeServerPath = () => false',
      '',
    ].join('\n')
  }
  if (!filter) {
    return [
      'export const serverPathFallback = true',
      'export const mightBeServerPath = () => true',
      '',
    ].join('\n')
  }
  const lines = [
    'export const serverPathFallback = true',
    `const locations = ${serverPathFilterLocations.toString()}`,
    ...renderBloomFilter(filter.paths, 'path'),
    ...renderBloomFilter(filter.shapes, 'shape'),
  ]
  if (!filter.shapes.entries) {
    lines.push('export const mightBeServerPath = testPath')
    return [...lines, ''].join('\n')
  }
  lines.push(
    // every shape the path could have: each segment either itself or a route parameter, and
    // every prefix of those followed by a route wildcard
    `const shapeOf = (segments, length, mask) => {`,
    `  let shape = ''`,
    `  for (let i = 1; i <= length; i++) { shape += '/' + ((mask >> (i - 1)) & 1 ? ${JSON.stringify(PARAM)} : segments[i]) }`,
    `  return shape`,
    `}`,
    `const maskCount = length => length > ${MAX_SHAPE_DEPTH} ? 1 : 1 << length`,
    `export const mightBeServerPath = (path) => {`,
    ...filter.paths.entries ? ['  if (testPath(path)) { return true }'] : [],
    `  const segments = path.split('/')`,
    `  const depth = segments.length - 1`,
    `  for (let mask = 1; mask < maskCount(depth); mask++) {`,
    `    if (testShape(shapeOf(segments, depth, mask))) { return true }`,
    `  }`,
    `  for (let length = depth - 1; length > 0; length--) {`,
    `    for (let mask = 0; mask < maskCount(length); mask++) {`,
    `      if (testShape(shapeOf(segments, length, mask) + '/' + ${JSON.stringify(REST)})) { return true }`,
    `    }`,
    `  }`,
    `  return false`,
    `}`,
  )
  return [...lines, ''].join('\n')
}

function renderBloomFilter (filter: BloomFilter, name: 'path' | 'shape'): string[] {
  if (!filter.entries) { return [] }
  return [
    `const ${name}Bits = Uint8Array.from(atob(${JSON.stringify(Buffer.from(filter.bits).toString('base64'))}), c => c.charCodeAt(0))`,
    `const test${name === 'path' ? 'Path' : 'Shape'} = value => locations(value, ${filter.hashCount}, ${filter.bitCount}).every(n => ${name}Bits[n >> 3] & (1 << (n & 7)))`,
  ]
}
