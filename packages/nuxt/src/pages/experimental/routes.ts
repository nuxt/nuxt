import { createRouterMatcher } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { genImport, genObjectFromRawEntries } from 'knitwork'
import type { NuxtPage } from 'nuxt/schema'
import { toArray } from '../../utils.ts'
import { collectStaticPagePaths, normalizeRouteEntries } from '../utils.ts'
import type { NormalizeRoutesOptions, NormalizedRouteEntry } from '../utils.ts'
import { tokenizeRoutePath } from './path-tokens.ts'

type ClassicMatcher = ReturnType<ReturnType<typeof createRouterMatcher>['getRoutes']>[number]

export interface ExperimentalRoutesOptions extends NormalizeRoutesOptions {
  /** Whether paths are matched case-sensitively. */
  sensitive: boolean
  /** Module exporting `StaticPathMatcher` and `DynamicPathMatcher`. */
  matchersModule: string
  /** Called for a page whose `definePageMeta` sets `path` or `alias` with a value unknown at build time. */
  onRuntimePath?: (page: NuxtPage, keys: string[]) => void
}

/**
 * Compiles the page routes for `createFixedResolver()` from `vue-router/experimental`: a
 * record per route, in the order the classic router would match them, with path matchers
 * built from the regexps of the classic path parser.
 */
export function genExperimentalRoutes (pages: NuxtPage[], imports: Set<string>, options: ExperimentalRoutesOptions): string {
  const entries = normalizeRouteEntries(pages, imports, options)
  const matcher = createRouterMatcher(toClassicRecords(entries, options.onRuntimePath, { next: 0 }), { sensitive: options.sensitive, strict: false })

  const ranked = matcher.getRoutes()
  const matchers = new Map<ClassicMatcher['record'], ClassicMatcher>()
  const collect = (m: ClassicMatcher) => {
    if (matchers.has(m.record)) { return }
    matchers.set(m.record, m)
    if (m.parent) { collect(m.parent) }
  }
  ranked.forEach(collect)

  const code: string[] = []
  const paths = new Map<string, string>()
  const records = new Map<ClassicMatcher, string>()
  let usesStatic = false
  let usesDynamic = false

  const pathId = (m: ClassicMatcher) => {
    const path = m.record.path
    let id = paths.get(path)
    if (!id) {
      id = `p${paths.size}`
      paths.set(path, id)
      const expression = genPathMatcher(m)
      usesStatic ||= expression.startsWith('new StaticPathMatcher')
      usesDynamic ||= expression.startsWith('new DynamicPathMatcher')
      code.push(`const ${id} = ${expression}`)
    }
    return id
  }

  const recordId = (m: ClassicMatcher): string => {
    let id = records.get(m)
    if (id) { return id }
    const parent = m.parent ? recordId(m.parent) : undefined
    const aliasOf = m.record.aliasOf ? recordId(matchers.get(m.record.aliasOf)!) : undefined
    id = `r${records.size}`
    records.set(m, id)
    const path = pathId(m)
    const record = aliasOf
      // an alias shares everything but its path and position in the tree with the original
      ? `{ ...${aliasOf}, path: ${path}, parent: ${parent ?? 'undefined'}, aliasOf: ${aliasOf} }`
      : genObjectFromRawEntries([...genRecordFields((m.record.meta as { entry: NormalizedRouteEntry }).entry), ['path', path], ...parent ? [['parent', parent] as [string, string]] : []])
    code.push(`const ${id} = normalizeRouteRecord(${record})`)
    return id
  }

  const rankedIds = ranked.map(recordId)

  const matcherImports = [...usesStatic ? ['StaticPathMatcher'] : [], ...usesDynamic ? ['DynamicPathMatcher'] : []]
  return [
    ...matcherImports.length ? [genImport(options.matchersModule, matcherImports)] : [],
    genImport('vue-router/experimental', ['createFixedResolver', 'normalizeRouteRecord']),
    ...imports,
    ...code,
    `export const records = [${rankedIds.join(', ')}]`,
    'export const resolver = createFixedResolver(records)',
    `export const prerenderPaths = ${JSON.stringify([...collectStaticPagePaths(pages)])}`,
    ROUTES_HMR_CODE,
  ].join('\n')
}

/**
 * Routes for the classic matcher, which ranks them and parses their paths. Each record links back
 * to its entry. Named records get a unique placeholder name, as the matcher drops a record whose
 * name is already taken.
 */
function toClassicRecords (entries: NormalizedRouteEntry[], onRuntimePath: ExperimentalRoutesOptions['onRuntimePath'], names: { next: number }): RouteRecordRaw[] {
  return entries.map((entry) => {
    const { page, route } = entry
    const runtimeKeys = ['path', 'alias'].filter(key => entry.dynamic.has(key))
    if (runtimeKeys.length) { onRuntimePath?.(page, runtimeKeys) }
    const alias = toArray(page.alias).filter(Boolean) as string[]
    return {
      path: page.path,
      ...alias.length ? { alias } : {},
      // the classic matcher skips records with none of these, as the resolver does
      ...route.name !== undefined ? { name: `_${names.next++}` } : {},
      ...route.component || route.components ? { component: {} } : {},
      ...route.redirect !== undefined ? { redirect: '/' } : {},
      meta: { entry },
      ...entry.children ? { children: toClassicRecords(entry.children, onRuntimePath, names) } : {},
    } as RouteRecordRaw
  })
}

function genRecordFields (entry: NormalizedRouteEntry): [string, string][] {
  const { route } = entry
  const fields: [string, string][] = []
  if (route.name !== undefined) { fields.push(['name', route.name]) }
  if (route.meta !== undefined) { fields.push(['meta', route.meta]) }
  if (route.redirect !== undefined) { fields.push(['redirect', route.redirect]) }
  if (route.components) {
    fields.push(['components', route.components])
    // named views declare `props` per view
    if (route.props !== undefined) { fields.push(['props', route.props]) }
  } else if (route.component) {
    fields.push(['components', `{ default: ${route.component} }`])
    if (route.props !== undefined) { fields.push(['props', `{ default: ${route.props} }`]) }
  }
  return fields
}

/** A path matcher for the record, from the regexp and keys the classic parser produced for its full path. */
function genPathMatcher (m: ClassicMatcher): string {
  const segments = tokenizeRoutePath(m.record.path)
  if (!m.keys.length) {
    return `new StaticPathMatcher(${JSON.stringify('/' + segments.map(segment => segment.join('')).join('/'))})`
  }
  const params = genObjectFromRawEntries(m.keys.map(key => [key.name, JSON.stringify(key.repeatable || key.optional ? [0, +key.repeatable, ...key.optional ? [1] : []] : [])]))
  const parts = segments.map((segment) => {
    // strings are static parts, 1 a param whose slashes are encoded, 0 a param that keeps them
    const parts = segment.map(token => typeof token === 'string' ? token : token.regexp ? 0 : 1)
    return parts.length === 1 ? parts[0] : parts
  })
  return `new DynamicPathMatcher(/${m.re.source}/${m.re.flags}, ${params}, ${JSON.stringify(parts)})`
}

const ROUTES_HMR_CODE = /* js */`
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const router = import.meta.hot.data.router
    if (!router?._hmrReplaceResolver) {
      import.meta.hot.invalidate('[nuxt] Cannot replace routes because there is no active router. Reloading.')
      return
    }
    router._hmrReplaceResolver(mod.resolver)
    // Resolve the current path against the new routes to get updated meta
    const route = router.currentRoute.value
    const newRoute = router.resolve(route.fullPath)
    for (const key of Object.keys(route.meta)) {
      delete route.meta[key]
    }
    Object.assign(route.meta, newRoute.meta)
  })
}

export function handleHotUpdate (router) {
  if (import.meta.hot) {
    import.meta.hot.data ||= {}
    import.meta.hot.data.router = router
  }
}
`
