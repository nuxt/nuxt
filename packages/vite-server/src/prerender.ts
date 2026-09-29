import { cpus } from 'node:os'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'pathe'
import { joinURL, parseURL, withBase, withoutBase } from 'ufo'
import { logger } from '@nuxt/kit'
import { parse, walk } from 'ultrahtml'
import type { Nuxt, NuxtPage } from '@nuxt/schema'

import { createRouteRulesMatcher } from './route-rules.ts'

/** Header the renderer reports the routes a render asked to prerender as well on. */
const PRERENDER_HINTS_HEADER = 'x-nuxt-prerender'

const CRAWLABLE_EXTENSIONS = new Set(['', '.json'])
const EXTENSION_RE = /\.[\da-z]+$/
const JSON_SIGNATURE_RE = /^\s*["[{]|^\s*-?\d{1,16}(?:\.\d{1,17})?(?:e[+-]?\d+)?\s*$/i
const HTML_ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&apos;': '\'', '&quot;': '"' }
const HTML_ENTITY_RE = /&(?:lt|gt|amp|apos|quot);/g
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const WRITABLE_STATUSES = new Set([200, 304, ...REDIRECT_STATUSES])

/** Longest path segment most file systems accept. */
const FS_MAX_SEGMENT = 255

type IgnorePattern = string | RegExp | ((path: string) => boolean | undefined)

interface ResolvedPrerenderConfig {
  routes: string[]
  ignore: IgnorePattern[]
  crawlLinks: boolean
  autoSubfolderIndex: boolean
  concurrency: number
  interval: number
  failOnError: boolean
}

interface PrerenderedRoute {
  route: string
  fileName?: string
  error?: { status: number, statusText: string }
}

/** Whether the build produces a prerendered site rather than a server. */
export function isPrerendering (nuxt: Nuxt): boolean {
  return !nuxt.options.dev && nuxt.options.ssr !== false && !!nuxt.options.nitro.static
}

function resolvePrerenderConfig (nuxt: Nuxt): ResolvedPrerenderConfig {
  const config = nuxt.options.nitro.prerender || {}
  return {
    routes: (config.routes || []).filter(Boolean) as string[],
    ignore: (config.ignore || []) as IgnorePattern[],
    crawlLinks: config.crawlLinks ?? true,
    autoSubfolderIndex: config.autoSubfolderIndex ?? true,
    concurrency: config.concurrency || cpus().length * 4 || 4,
    interval: config.interval || 0,
    failOnError: config.failOnError ?? true,
  }
}

/**
 * Crawl the built application and write a static copy of every route it reaches.
 *
 * The handler is a web-standard `fetch`, so it is driven in-process: there is no port to
 * allocate and no process to wait on. Routes a render reports while it runs are queued as
 * they arrive, so one pass reaches the whole reachable app.
 */
export async function prerenderRoutes (nuxt: Nuxt, options: { publicDir: string, handler: string }): Promise<string[]> {
  const config = resolvePrerenderConfig(nuxt)
  const baseURL = nuxt.options.app.baseURL || '/'

  const queue = new Set<string>()
  for (const route of seedRoutes(nuxt, config)) {
    queue.add(route)
  }
  await nuxt.callHook('prerender:routes', { routes: queue })

  const { fetch } = await import(pathToFileURL(options.handler).href) as { fetch: (request: Request) => Promise<Response> }

  const canPrerender = createPrerenderFilter(nuxt, config)
  const generated = new Set<string>()
  const failed: PrerenderedRoute[] = []
  const written: PrerenderedRoute[] = []
  const linkParents = new Map<string, Set<string>>()

  async function generateRoute (route: string): Promise<void> {
    route = decodeURI(route)
    if (generated.has(route) || !canPrerender(route)) { return }
    generated.add(route)

    const request = new Request(new URL(withBase(encodeURI(route), baseURL), 'http://localhost'))
    const response = await fetch(request)
    const body = Buffer.from(await response.arrayBuffer())

    const entry: PrerenderedRoute = { route }
    if (!WRITABLE_STATUSES.has(response.status)) {
      entry.error = { status: response.status, statusText: response.statusText }
      failed.push(entry)
      logRoute(entry, linkParents)
      return
    }

    const contentType = response.headers.get('content-type') || ''
    const isRedirect = REDIRECT_STATUSES.has(response.status)
    const isImplicitHTML = !route.endsWith('.html') && (isRedirect || contentType.includes('html')) && !JSON_SIGNATURE_RE.test(body.subarray(0, 32).toString('utf-8'))
    const htmlPath = route.endsWith('/') || config.autoSubfolderIndex ? joinURL(route, 'index.html') : route + '.html'
    const fileName = withoutBase(isImplicitHTML ? htmlPath : (route.endsWith('/') ? route + 'index' : route), baseURL)

    if (canWriteToDisk(route, fileName)) {
      entry.fileName = fileName
      const path = join(options.publicDir, fileName)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, body)
      written.push(entry)
    }

    logRoute(entry, linkParents)

    if (isImplicitHTML || route.endsWith('.html')) {
      for (const link of await extractLinks(body.toString('utf-8'), route, response, config.crawlLinks)) {
        const parents = linkParents.get(link)
        if (parents) {
          parents.add(route)
        } else {
          linkParents.set(link, new Set([route]))
        }
        // a route carrying a query cannot become a file, so following one only risks a
        // crawl that never drains (`?page=2` linking `?page=3`, and so on)
        if (!link.includes('?') && canPrerender(link) && !generated.has(link)) {
          queue.add(link)
        }
      }
    }
  }

  const start = Date.now()
  logger.info(config.crawlLinks ? `Prerendering ${queue.size} initial routes with crawler` : `Prerendering ${queue.size} routes`)
  await runParallel(queue, generateRoute, config, (route, error) => {
    const entry: PrerenderedRoute = { route, error: { status: 500, statusText: error instanceof Error ? error.message : String(error) } }
    failed.push(entry)
    logRoute(entry, linkParents)
  })

  if (failed.length && config.failOnError) {
    throw new Error(`[nuxt:vite-server] Exiting due to prerender errors: ${failed.map(entry => `"${entry.route}" (${entry.error!.status})`).join(', ')}.`)
  }

  logger.info(`Prerendered ${written.length} routes in ${(Date.now() - start) / 1000} seconds`)

  return written.map(entry => entry.route)
}

/**
 * The routes the crawl starts from. A dynamic page route or a wildcard rule key cannot be
 * turned back into a path, so reaching those is left to the hints and the crawler.
 */
function seedRoutes (nuxt: Nuxt, config: ResolvedPrerenderConfig): Set<string> {
  const routes = new Set<string>(config.routes)

  const errorPageOption = nuxt.options.experimental.prerenderErrorPages
  const errorPages = errorPageOption === true ? [404] : errorPageOption || []
  for (const route of ['/200.html', '/404.html']) {
    routes.add(route)
  }
  for (const status of errorPages) {
    routes.add(`/${status}.html`)
  }

  const rules = nuxt.options.routeRules || {}
  for (const path in rules) {
    if (rules[path]?.prerender && !path.includes('*')) {
      routes.add(path)
    }
  }

  const pages = nuxt.apps.default?.pages
  if (pages && !nuxt.options.router.options.hashMode) {
    const matcher = createRouteRulesMatcher(nuxt)
    for (const route of staticPageRoutes(pages)) {
      if (config.crawlLinks || matcher(route).prerender) {
        routes.add(route)
      }
    }
  }

  if (!routes.size && config.crawlLinks) {
    routes.add('/')
  }

  return routes
}

const OPTIONAL_PARAM_RE = /^\/?:.*(?:\?|\(\.\*\)\*)$/

function staticPageRoutes (pages: NuxtPage[], currentPath = '/', routes = new Set<string>()): Set<string> {
  for (const page of pages) {
    if (page._sync) { continue }
    if (OPTIONAL_PARAM_RE.test(page.path) && !page.children?.length) {
      routes.add(currentPath)
    }
    if (page.path.includes(':')) { continue }

    const route = joinURL(currentPath, page.path)
    routes.add(route)
    if (page.children) {
      staticPageRoutes(page.children, route, routes)
    }
  }
  return routes
}

function createPrerenderFilter (nuxt: Nuxt, config: ResolvedPrerenderConfig): (route: string) => boolean {
  const baseURL = nuxt.options.app.baseURL || '/'
  const matcher = createRouteRulesMatcher(nuxt)

  return function canPrerender (route: string): boolean {
    for (const pattern of config.ignore) {
      if (typeof pattern === 'string' ? route.startsWith(pattern) : pattern instanceof RegExp ? matchesPattern(pattern, route) : pattern(route) === true) {
        return false
      }
    }
    return matcher(withoutBase(route, baseURL)).prerender !== false
  }
}

function matchesPattern (pattern: RegExp, route: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(route)
}

function canWriteToDisk (route: string, fileName: string): boolean {
  if (route.includes('?') || route.includes('..')) { return false }
  if (fileName.split('/').some(segment => segment.length > FS_MAX_SEGMENT)) {
    logger.warn(`Skipping prerender of "${route}": a path segment exceeds the ${FS_MAX_SEGMENT}-character limit.`)
    return false
  }
  return true
}

async function extractLinks (html: string, from: string, response: Response, crawlLinks: boolean): Promise<string[]> {
  const candidates: string[] = []

  if (crawlLinks) {
    await walk(parse(html), (node) => {
      const href = (node as { attributes?: Record<string, string> }).attributes?.href
      if (!href) { return }
      const link = href.replace(HTML_ENTITY_RE, entity => HTML_ENTITIES[entity] || entity)
      const decoded = decode(link)
      if (decoded !== undefined && !decoded.startsWith('#') && CRAWLABLE_EXTENSIONS.has(parseURL(link).pathname.match(EXTENSION_RE)?.[0] || '')) {
        candidates.push(link)
      }
    })
  }

  for (const hint of (response.headers.get(PRERENDER_HINTS_HEADER) || '').split(',')) {
    const decoded = hint.trim() && decode(hint.trim())
    if (decoded) {
      candidates.push(decoded)
    }
  }

  const links: string[] = []
  for (const candidate of candidates) {
    const url = parseURL(candidate)
    if (url.protocol || url.host) { continue }
    if (!url.pathname.startsWith('/')) {
      url.pathname = new URL(url.pathname, new URL(from, 'http://localhost')).pathname
    }
    links.push(url.pathname + url.search)
  }
  return links
}

/** Percent-decode a link, or report it as one to leave alone. */
function decode (value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function logRoute (route: PrerenderedRoute, linkParents: Map<string, Set<string>>): void {
  if (!route.error) {
    logger.log(`  ├─ ${route.route}${route.fileName ? '' : ' (skipped)'}`)
    return
  }
  const parents = linkParents.get(route.route)
  logger.log([
    `  ├─ ${route.route} (${route.error.status} ${route.error.statusText})`,
    ...[...parents || []].map(parent => `  │ └── Linked from ${parent}`),
  ].join('\n'))
}

/** Drain a set the tasks themselves add to, running at most `concurrency` at a time. */
async function runParallel (queue: Set<string>, task: (route: string) => Promise<void>, options: { concurrency: number, interval: number }, onError: (route: string, error: unknown) => void): Promise<void> {
  const running = new Set<Promise<void>>()

  function next (): Promise<void> | undefined {
    const route = queue.values().next().value
    if (!route) { return }
    queue.delete(route)

    // one route that throws is one failed route, not an abandoned crawl
    const started = (options.interval ? new Promise<void>(resolve => setTimeout(resolve, options.interval)) : Promise.resolve())
      .then(() => task(route))
      .catch(error => onError(route, error))
    running.add(started)
    return started.then(async () => {
      running.delete(started)
      if (queue.size > 0) { await refill() }
    })
  }

  function refill (): Promise<unknown> {
    const workers = Math.min(options.concurrency - running.size, queue.size)
    return Promise.all(Array.from({ length: workers }, () => next()))
  }

  await refill()
}

/**
 * Write the app manifest, without which a client-side navigation cannot tell that a route
 * has a payload file to load, and refetches the data instead.
 */
export async function writeAppManifest (nuxt: Nuxt, publicDir: string, routes: string[]): Promise<void> {
  const buildId = nuxt.options.runtimeConfig.app.buildId
  const timestamp = manifestTimestamp(nuxt)
  const baseURL = nuxt.options.app.baseURL || '/'
  const matcher = createRouteRulesMatcher(nuxt)
  const prerendered = new Set<string>()
  for (const route of routes) {
    if (!route.endsWith(PAYLOAD_SUFFIX)) { continue }
    const path = route.slice(0, -PAYLOAD_SUFFIX.length) || '/'
    // a route the client can resolve a `prerender` rule for needs no entry of its own
    if (!matcher(withoutBase(path, baseURL)).prerender) {
      prerendered.add(path)
    }
  }

  const dir = resolve(publicDir, joinURL(nuxt.options.app.buildAssetsDir, 'builds').replace(/^\//, ''))
  await mkdir(join(dir, 'meta'), { recursive: true })
  await writeFile(join(dir, 'latest.json'), JSON.stringify({ id: buildId, timestamp }))
  await writeFile(join(dir, `meta/${buildId}.json`), JSON.stringify({ id: buildId, timestamp, prerendered: [...prerendered] }))
}

const PAYLOAD_SUFFIX = '/_payload.json'

const timestamps = new WeakMap<Nuxt, number>()

/** One timestamp per build, shared by the stub the bundle inlines and the file the client fetches. */
export function manifestTimestamp (nuxt: Nuxt): number {
  const existing = timestamps.get(nuxt)
  if (existing !== undefined) { return existing }
  const timestamp = Date.now()
  timestamps.set(nuxt, timestamp)
  return timestamp
}
