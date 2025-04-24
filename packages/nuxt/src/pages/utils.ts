import { runInNewContext } from 'node:vm'
import fs from 'node:fs'
import { extname, normalize, relative, resolve } from 'pathe'
import { encodePath, joinURL, withLeadingSlash } from 'ufo'
import { resolveFiles, resolvePath, useNuxt } from '@nuxt/kit'
import { genArrayFromRaw, genDynamicImport, genImport, genSafeVariableName } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'
import type { Node, Property } from 'estree'
import type { NuxtPage } from 'nuxt/schema'

import { klona } from 'klona'
import { parseAndWalk, withLocations } from '../core/utils/parse'
import { getLoader, uniqueBy } from '../core/utils'
import { logger, toArray } from '../utils'

enum SegmentParserState {
  initial,
  static,
  dynamic,
  optional,
  catchall,
  group,
}

enum SegmentTokenType {
  static,
  dynamic,
  optional,
  catchall,
  group,
}

interface SegmentToken {
  type: SegmentTokenType
  value: string
}

interface ScannedFile {
  relativePath: string
  absolutePath: string
}

export async function resolvePagesRoutes (pattern: string | string[], nuxt = useNuxt()): Promise<NuxtPage[]> {
  const pagesDirs = nuxt.options._layers.map(
    layer => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : layer.config.dir)?.pages || 'pages'),
  )

  const scannedFiles: ScannedFile[] = []
  for (const dir of pagesDirs) {
    const files = await resolveFiles(dir, pattern)
    scannedFiles.push(...files.map(file => ({ relativePath: relative(dir, file), absolutePath: file })))
  }

  // sort scanned files using en-US locale to make the result consistent across different system locales
  scannedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en-US'))

  const allRoutes = generateRoutesFromFiles(uniqueBy(scannedFiles, 'relativePath'), {
    shouldUseServerComponents: !!nuxt.options.experimental.componentIslands,
  })

  const pages = uniqueBy(allRoutes, 'path')
  const shouldAugment = nuxt.options.experimental.scanPageMeta || nuxt.options.experimental.typedPages

  if (shouldAugment === false) {
    await nuxt.callHook('pages:extend', pages)
    return pages
  }

  const augmentCtx = {
    extraExtractionKeys: ['middleware', ...nuxt.options.experimental.extraPageMetaExtractionKeys],
    fullyResolvedPaths: new Set(scannedFiles.map(file => file.absolutePath)),
  }
  if (shouldAugment === 'after-resolve') {
    await nuxt.callHook('pages:extend', pages)
    await augmentPages(pages, nuxt.vfs, augmentCtx)
  } else {
    const augmentedPages = await augmentPages(pages, nuxt.vfs, augmentCtx)
    await nuxt.callHook('pages:extend', pages)
    await augmentPages(pages, nuxt.vfs, { pagesToSkip: augmentedPages, ...augmentCtx })
    augmentedPages?.clear()
  }

  await nuxt.callHook('pages:resolved', pages)

  return pages
}

type GenerateRoutesFromFilesOptions = {
  shouldUseServerComponents?: boolean
}

const INDEX_PAGE_RE = /\/index$/
export function generateRoutesFromFiles (files: ScannedFile[], options: GenerateRoutesFromFilesOptions = {}): NuxtPage[] {
  const routes: NuxtPage[] = []

  const sortedFiles = [...files].sort((a, b) => a.relativePath.length - b.relativePath.length)

  for (const file of sortedFiles) {
    const segments = file.relativePath
      .replace(new RegExp(`${escapeRE(extname(file.relativePath))}$`), '')
      .split('/')

    const route: NuxtPage = {
      name: '',
      path: '',
      file: file.absolutePath,
      children: [],
    }

    // Array where routes should be added, useful when adding child routes
    let parent = routes

    const lastSegment = segments[segments.length - 1]!
    if (lastSegment.endsWith('.server')) {
      segments[segments.length - 1] = lastSegment.replace('.server', '')
      if (options.shouldUseServerComponents) {
        route.mode = 'server'
      }
    } else if (lastSegment.endsWith('.client')) {
      segments[segments.length - 1] = lastSegment.replace('.client', '')
      route.mode = 'client'
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      const tokens = parseSegment(segment!, file.absolutePath)

      // Skip group segments
      if (tokens.every(token => token.type === SegmentTokenType.group)) {
        continue
      }

      const segmentName = tokens.map(({ value, type }) => type === SegmentTokenType.group ? '' : value).join('')

      // ex: parent/[slug].vue -> parent-slug
      route.name += (route.name && '/') + segmentName

      // ex: parent.vue + parent/child.vue
      const routePath = getRoutePath(tokens, segments[i + 1] !== undefined && segments[i + 1] !== 'index')
      const path = withLeadingSlash(joinURL(route.path, routePath.replace(INDEX_PAGE_RE, '/')))
      const child = parent.find(parentRoute => parentRoute.name === route.name && parentRoute.path === path)

      if (child && child.children) {
        parent = child.children
        route.path = ''
      } else if (segmentName === 'index' && !route.path) {
        route.path += '/'
      } else if (segmentName !== 'index') {
        route.path += routePath
      }
    }

    parent.push(route)
  }

  return prepareRoutes(routes)
}

interface AugmentPagesContext {
  fullyResolvedPaths?: Set<string>
  pagesToSkip?: Set<string>
  augmentedPages?: Set<string>
  extraExtractionKeys?: string[]
}

export async function augmentPages (routes: NuxtPage[], vfs: Record<string, string>, ctx: AugmentPagesContext = {}) {
  ctx.augmentedPages ??= new Set()
  for (const route of routes) {
    if (route.file && !ctx.pagesToSkip?.has(route.file)) {
      const fileContent = route.file in vfs
        ? vfs[route.file]!
        : fs.readFileSync(ctx.fullyResolvedPaths?.has(route.file) ? route.file : await resolvePath(route.file), 'utf-8')
      const routeMeta = getRouteMeta(fileContent, route.file, ctx.extraExtractionKeys)
      if (route.meta) {
        routeMeta.meta = { ...routeMeta.meta, ...route.meta }
      }

      Object.assign(route, routeMeta)
      ctx.augmentedPages.add(route.file)
    }

    if (route.children && route.children.length > 0) {
      await augmentPages(route.children, vfs, ctx)
    }
  }
  return ctx.augmentedPages
}

const SFC_SCRIPT_RE = /<script(?<attrs>[^>]*)>(?<content>[\s\S]*?)<\/script[^>]*>/gi
export function extractScriptContent (sfc: string) {
  const contents: Array<{ loader: 'tsx' | 'ts', code: string }> = []
  for (const match of sfc.matchAll(SFC_SCRIPT_RE)) {
    if (match?.groups?.content) {
      contents.push({
        loader: match.groups.attrs && /[tj]sx/.test(match.groups.attrs) ? 'tsx' : 'ts',
        code: match.groups.content.trim(),
      })
    }
  }

  return contents
}

const PAGE_META_RE = /definePageMeta\([\s\S]*?\)/
export const defaultExtractionKeys = ['name', 'path', 'props', 'alias', 'redirect', 'middleware'] as const
const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const

const pageContentsCache: Record<string, string> = {}
const metaCache: Record<string, Partial<Record<keyof NuxtPage, any>>> = {}
export function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys: string[] = []): Partial<Record<keyof NuxtPage, any>> {
  // set/update pageContentsCache, invalidate metaCache on cache mismatch
  if (!(absolutePath in pageContentsCache) || pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    delete metaCache[absolutePath]
  }

  if (absolutePath in metaCache && metaCache[absolutePath]) {
    return klona(metaCache[absolutePath])
  }

  const loader = getLoader(absolutePath)
  const scriptBlocks = !loader ? null : loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader }]
  if (!scriptBlocks) {
    metaCache[absolutePath] = {}
    return {}
  }

  const extractedMeta: Partial<Record<keyof NuxtPage, any>> = {}

  const extractionKeys = new Set<keyof NuxtPage>([...defaultExtractionKeys, ...extraExtractionKeys as Array<keyof NuxtPage>])

  for (const script of scriptBlocks) {
    if (!PAGE_META_RE.test(script.code)) {
      continue
    }

    const dynamicProperties = new Set<keyof NuxtPage>()

    let foundMeta = false

    parseAndWalk(script.code, absolutePath.replace(/\.\w+$/, '.' + script.loader), (node) => {
      if (foundMeta) { return }

      if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression' || node.expression.callee.type !== 'Identifier' || node.expression.callee.name !== 'definePageMeta') { return }

      foundMeta = true
      const pageMetaArgument = node.expression.arguments[0]
      if (pageMetaArgument?.type !== 'ObjectExpression') {
        logger.warn(`\`definePageMeta\` must be called with an object literal (reading \`${absolutePath}\`).`)
        return
      }

      for (const key of extractionKeys) {
        const property = pageMetaArgument.properties.find((property): property is Property => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === key)
        if (!property) { continue }

        const propertyValue = withLocations(property.value)

        const { value, serializable } = isSerializable(script.code, propertyValue)
        if (!serializable) {
          logger.debug(`Skipping extraction of \`${key}\` metadata as it is not JSON-serializable (reading \`${absolutePath}\`).`)
          dynamicProperties.add(extraExtractionKeys.includes(key) ? 'meta' : key)
          continue
        }

        if (extraExtractionKeys.includes(key)) {
          extractedMeta.meta ??= {}
          extractedMeta.meta[key] = value
        } else {
          extractedMeta[key] = value
        }
      }

      for (const property of pageMetaArgument.properties) {
        if (property.type !== 'Property') {
          continue
        }
        const isIdentifierOrLiteral = property.key.type === 'Literal' || property.key.type === 'Identifier'
        if (!isIdentifierOrLiteral) {
          continue
        }
        const name = property.key.type === 'Identifier' ? property.key.name : String(property.value)
        if (!extractionKeys.has(name as keyof NuxtPage)) {
          dynamicProperties.add('meta')
          break
        }
      }

      if (dynamicProperties.size) {
        extractedMeta.meta ??= {}
        extractedMeta.meta[DYNAMIC_META_KEY] = dynamicProperties
      }
    })
  }

  metaCache[absolutePath] = extractedMeta
  return klona(extractedMeta)
}

const COLON_RE = /:/g
function getRoutePath (tokens: SegmentToken[], hasSucceedingSegment = false): string {
  return tokens.reduce((path, token) => {
    return (
      path +
      (token.type === SegmentTokenType.optional
        ? `:${token.value}?`
        : token.type === SegmentTokenType.dynamic
          ? `:${token.value}()`
          : token.type === SegmentTokenType.catchall
            ? hasSucceedingSegment ? `:${token.value}([^/]*)*` : `:${token.value}(.*)*`
            : token.type === SegmentTokenType.group
              ? ''
              : encodePath(token.value).replace(COLON_RE, '\\:'))
    )
  }, '/')
}

const PARAM_CHAR_RE = /[\w.]/

function parseSegment (segment: string, absolutePath: string) {
  let state: SegmentParserState = SegmentParserState.initial
  let i = 0

  let buffer = ''
  const tokens: SegmentToken[] = []

  function consumeBuffer () {
    if (!buffer) {
      return
    }
    if (state === SegmentParserState.initial) {
      throw new Error('wrong state')
    }

    tokens.push({
      type:
        state === SegmentParserState.static
          ? SegmentTokenType.static
          : state === SegmentParserState.dynamic
            ? SegmentTokenType.dynamic
            : state === SegmentParserState.optional
              ? SegmentTokenType.optional
              : state === SegmentParserState.catchall
                ? SegmentTokenType.catchall
                : SegmentTokenType.group,
      value: buffer,
    })

    buffer = ''
  }

  while (i < segment.length) {
    const c = segment[i]

    switch (state) {
      case SegmentParserState.initial:
        buffer = ''
        if (c === '[') {
          state = SegmentParserState.dynamic
        } else if (c === '(') {
          state = SegmentParserState.group
        } else {
          i--
          state = SegmentParserState.static
        }
        break

      case SegmentParserState.static:
        if (c === '[') {
          consumeBuffer()
          state = SegmentParserState.dynamic
        } else if (c === '(') {
          consumeBuffer()
          state = SegmentParserState.group
        } else {
          buffer += c
        }
        break

      case SegmentParserState.catchall:
      case SegmentParserState.dynamic:
      case SegmentParserState.optional:
      case SegmentParserState.group:
        if (buffer === '...') {
          buffer = ''
          state = SegmentParserState.catchall
        }
        if (c === '[' && state === SegmentParserState.dynamic) {
          state = SegmentParserState.optional
        }
        if (c === ']' && (state !== SegmentParserState.optional || segment[i - 1] === ']')) {
          if (!buffer) {
            throw new Error('Empty param')
          } else {
            consumeBuffer()
          }
          state = SegmentParserState.initial
        } else if (c === ')' && state === SegmentParserState.group) {
          if (!buffer) {
            throw new Error('Empty group')
          } else {
            consumeBuffer()
          }
          state = SegmentParserState.initial
        } else if (c && PARAM_CHAR_RE.test(c)) {
          buffer += c
        } else if (state === SegmentParserState.dynamic || state === SegmentParserState.optional) {
          if (c !== '[' && c !== ']') {
            logger.warn(`'\`${c}\`' is not allowed in a dynamic route parameter and has been ignored. Consider renaming \`${absolutePath}\`.`)
          }
        }
        break
    }
    i++
  }

  if (state === SegmentParserState.dynamic) {
    throw new Error(`Unfinished param "${buffer}"`)
  }

  consumeBuffer()

  return tokens
}

function findRouteByName (name: string, routes: NuxtPage[]): NuxtPage | undefined {
  for (const route of routes) {
    if (route.name === name) {
      return route
    }
  }
  return findRouteByName(name, routes)
}

const NESTED_PAGE_RE = /\//g
function prepareRoutes (routes: NuxtPage[], parent?: NuxtPage, names = new Set<string>()) {
  for (const route of routes) {
    // Remove -index
    if (route.name) {
      route.name = route.name
        .replace(INDEX_PAGE_RE, '')
        .replace(NESTED_PAGE_RE, '-')

      if (names.has(route.name)) {
        const existingRoute = findRouteByName(route.name, routes)
        const extra = existingRoute?.name ? `is the same as \`${existingRoute.file}\`` : 'is a duplicate'
        logger.warn(`Route name generated for \`${route.file}\` ${extra}. You may wish to set a custom name using \`definePageMeta\` within the page file.`)
      }
    }

    // Remove leading / if children route
    if (parent && route.path[0] === '/') {
      route.path = route.path.slice(1)
    }

    if (route.children?.length) {
      route.children = prepareRoutes(route.children, route, names)
    }

    if (route.children?.find(childRoute => childRoute.path === '')) {
      delete route.name
    }

    if (route.name) {
      names.add(route.name)
    }
  }

  return routes
}

function serializeRouteValue (value: any, skipSerialisation = false) {
  if (skipSerialisation || value === undefined) { return undefined }
  return JSON.stringify(value)
}

type NormalizedRoute = Partial<Record<Exclude<keyof NuxtPage, 'file'>, string>> & { component?: string }
type NormalizedRouteKeys = (keyof NormalizedRoute)[]
interface NormalizeRoutesOptions {
  overrideMeta?: boolean
  serverComponentRuntime: string
  clientComponentRuntime: string
}
export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set(), options: NormalizeRoutesOptions): { imports: Set<string>, routes: string } {
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const markedDynamic = page.meta?.[DYNAMIC_META_KEY] ?? new Set()
      const metaFiltered: Record<string, any> = {}
      let skipMeta = true
      for (const key in page.meta || {}) {
        if (key !== DYNAMIC_META_KEY && page.meta![key] !== undefined) {
          skipMeta = false
          metaFiltered[key] = page.meta![key]
        }
      }
      const skipAlias = toArray(page.alias).every(val => !val)

      const route: NormalizedRoute = {
        path: serializeRouteValue(page.path),
        props: serializeRouteValue(page.props),
        name: serializeRouteValue(page.name),
        meta: serializeRouteValue(metaFiltered, skipMeta),
        alias: serializeRouteValue(toArray(page.alias), skipAlias),
        redirect: serializeRouteValue(page.redirect),
      }

      for (const key of [...defaultExtractionKeys, 'meta'] satisfies NormalizedRouteKeys) {
        if (route[key] === undefined) {
          delete route[key]
        }
      }

      if (page.children?.length) {
        route.children = normalizeRoutes(page.children, metaImports, options).routes
      }

      // Without a file, we can't use `definePageMeta` to extract route-level meta from the file
      if (!page.file) {
        return route
      }

      const file = normalize(page.file)
      const pageImportName = genSafeVariableName(filename(file) + hash(file).replace(/-/g, '_'))
      const metaImportName = pageImportName + 'Meta'
      metaImports.add(genImport(`${file}?macro=true`, [{ name: 'default', as: metaImportName }]))

      if (page._sync) {
        metaImports.add(genImport(file, [{ name: 'default', as: pageImportName }]))
      }

      const pageImport = page._sync && page.mode !== 'client' ? pageImportName : genDynamicImport(file)

      const metaRoute: NormalizedRoute = {
        name: `${metaImportName}?.name ?? ${route.name}`,
        path: `${metaImportName}?.path ?? ${route.path}`,
        props: `${metaImportName}?.props ?? ${route.props ?? false}`,
        meta: `${metaImportName} || {}`,
        alias: `${metaImportName}?.alias || []`,
        redirect: `${metaImportName}?.redirect`,
        component: page.mode === 'server'
          ? `() => createIslandPage(${route.name})`
          : page.mode === 'client'
            ? `() => createClientPage(${pageImport})`
            : pageImport,
      }

      if (page.mode === 'server') {
        metaImports.add(`
let _createIslandPage
async function createIslandPage (name) {
  _createIslandPage ||= await import(${JSON.stringify(options?.serverComponentRuntime)}).then(r => r.createIslandPage)
  return _createIslandPage(name)
};`)
      } else if (page.mode === 'client') {
        metaImports.add(`
let _createClientPage
async function createClientPage(loader) {
  _createClientPage ||= await import(${JSON.stringify(options?.clientComponentRuntime)}).then(r => r.createClientPage)
  return _createClientPage(loader);
}`)
      }

      if (route.children) {
        metaRoute.children = route.children
      }

      if (route.meta) {
        metaRoute.meta = `{ ...(${metaImportName} || {}), ...${route.meta} }`
      }

      if (options?.overrideMeta) {
        // skip and retain fallback if marked dynamic
        // set to extracted value or fallback if none extracted
        for (const key of ['name', 'path'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }
          metaRoute[key] = route[key] ?? `${metaImportName}?.${key}`
        }

        // set to extracted value or delete if none extracted
        for (const key of ['meta', 'alias', 'redirect', 'props'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }

          if (route[key] == null) {
            delete metaRoute[key]
            continue
          }

          metaRoute[key] = route[key]
        }
      } else {
        if (route.alias != null) {
          metaRoute.alias = `${route.alias}.concat(${metaImportName}?.alias || [])`
        }

        if (route.redirect != null) {
          metaRoute.redirect = route.redirect
        }
      }

      return metaRoute
    })),
  }
}

const PATH_TO_NITRO_GLOB_RE = /\/[^:/]*:\w.*$/
export function pathToNitroGlob (path: string) {
  if (!path) {
    return null
  }
  // Ignore pages with multiple dynamic parameters.
  if (path.indexOf(':') !== path.lastIndexOf(':')) {
    return null
  }

  return path.replace(PATH_TO_NITRO_GLOB_RE, '/**')
}

export function resolveRoutePaths (page: NuxtPage, parent = '/'): string[] {
  return [
    joinURL(parent, page.path),
    ...page.children?.flatMap(child => resolveRoutePaths(child, joinURL(parent, page.path))) || [],
  ]
}

export function isSerializable (code: string, node: Node): { value?: any, serializable: boolean } {
  const propertyValue = withLocations(node)

  if (propertyValue.type === 'ObjectExpression') {
    const valueString = code.slice(propertyValue.start, propertyValue.end)
    try {
      return {
        value: JSON.parse(runInNewContext(`JSON.stringify(${valueString})`, {})),
        serializable: true,
      }
    } catch {
      return {
        serializable: false,
      }
    }
  }

  if (propertyValue.type === 'ArrayExpression') {
    const values: string[] = []
    for (const element of propertyValue.elements) {
      if (!element) {
        continue
      }
      const { serializable, value } = isSerializable(code, element)
      if (!serializable) {
        return {
          serializable: false,
        }
      }
      values.push(value)
    }

    return {
      value: values,
      serializable: true,
    }
  }

  if (propertyValue.type === 'Literal' && (typeof propertyValue.value === 'string' || typeof propertyValue.value === 'boolean' || typeof propertyValue.value === 'number' || propertyValue.value === null)) {
    return {
      value: propertyValue.value,
      serializable: true,
    }
  }

  return {
    serializable: false,
  }
}
