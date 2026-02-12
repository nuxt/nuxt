import { runInNewContext } from 'node:vm'
import fs from 'node:fs'
import { normalize, relative } from 'pathe'
import { joinURL } from 'ufo'
import { getLayerDirectories, resolveFiles, resolvePath, useNuxt } from '@nuxt/kit'
import { genArrayFromRaw, genDynamicImport, genImport, genSafeVariableName } from 'knitwork'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'

import { defu } from 'defu'
import { klona } from 'klona'
import { parseAndWalk } from 'oxc-walker'
import { parseSync } from 'oxc-parser'
import type { CallExpression, ExpressionStatement, Node, ObjectProperty } from 'oxc-parser'
import { transformSync } from 'oxc-transform'
import { buildTree, toVueRouter4 } from 'unrouting'
import type { InputFile, VueRoute } from 'unrouting'
import { getLoader, uniqueBy } from '../core/utils/index.ts'
import { logger, toArray } from '../utils.ts'
import type { NuxtPage } from 'nuxt/schema'

interface ScannedFile {
  relativePath: string
  absolutePath: string
  /** Layer priority — lower number = higher priority (user project is 0). */
  priority?: number
}

export async function resolvePagesRoutes (pattern: string | string[], nuxt = useNuxt()): Promise<NuxtPage[]> {
  const pagesDirs = getLayerDirectories(nuxt).map(d => d.appPages)

  const scannedFiles: ScannedFile[] = []
  for (let priority = 0; priority < pagesDirs.length; priority++) {
    const dir = pagesDirs[priority]!
    const files = await resolveFiles(dir, pattern)
    scannedFiles.push(...files.map(file => ({ relativePath: relative(dir, file), absolutePath: file, priority })))
  }

  const allRoutes = generateRoutesFromFiles(scannedFiles, {
    shouldUseServerComponents: !!nuxt.options.experimental.componentIslands,
  })

  const pages = uniqueBy(allRoutes, 'path')
  const shouldAugment = nuxt.options.experimental.scanPageMeta || nuxt.options.experimental.typedPages

  if (shouldAugment === false) {
    await nuxt.callHook('pages:extend', pages)
    return pages
  }

  const extraPageMetaExtractionKeys = nuxt.options?.experimental?.extraPageMetaExtractionKeys || []

  const augmentCtx = {
    extraExtractionKeys: new Set([
      'middleware',
      ...extraPageMetaExtractionKeys,
    ]),
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

export function generateRoutesFromFiles (files: ScannedFile[], options: GenerateRoutesFromFilesOptions = {}): NuxtPage[] {
  if (!files.length) { return [] }

  // Build InputFile[] for unrouting and absolutePath lookup in a single pass
  const absolutePathMap = new Map<string, string>()
  const inputFiles: InputFile[] = new Array(files.length)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    absolutePathMap.set(file.relativePath, file.absolutePath)
    inputFiles[i] = { path: file.relativePath, priority: file.priority ?? 0 }
  }

  const tree = buildTree(inputFiles, {
    modes: options.shouldUseServerComponents ? ['server', 'client'] : ['client'],
    warn: msg => logger.warn(msg),
  })
  const vueRoutes = toVueRouter4(tree, {
    onDuplicateRouteName: (name, file, existingFile) => {
      logger.warn(`Route name generated for \`${absolutePathMap.get(file) || file}\` is the same as \`${absolutePathMap.get(existingFile) || existingFile}\`. You may wish to set a custom name using \`definePageMeta\` within the page file.`)
    },
  })

  // Convert VueRoute[] → NuxtPage[]
  function toNuxtPages (routes: VueRoute[]): NuxtPage[] {
    return routes.map((route) => {
      const page: NuxtPage = {
        name: route.name,
        path: route.path,
        file: route.file ? absolutePathMap.get(route.file) || route.file : undefined,
        children: route.children?.length ? toNuxtPages(route.children) : [],
      }

      // Map modes to Nuxt's mode field
      if (route.modes?.includes('server')) {
        page.mode = 'server'
      } else if (route.modes?.includes('client')) {
        page.mode = 'client'
      }

      // Pass through groups metadata
      if (route.meta?.groups) {
        page.meta = { ...page.meta, groups: route.meta.groups }
      }

      return page
    })
  }

  return toNuxtPages(vueRoutes)
}

interface AugmentPagesContext {
  fullyResolvedPaths?: Set<string>
  pagesToSkip?: Set<string>
  augmentedPages?: Set<string>
  extraExtractionKeys?: Set<string>
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
        routeMeta.meta = defu({}, routeMeta.meta, route.meta)
      }
      if (route.rules) {
        routeMeta.rules = defu({}, routeMeta.rules, route.rules)
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

const PAGE_EXTRACT_RE = /(definePageMeta|defineRouteRules)\([\s\S]*?\)/g
export const defaultExtractionKeys = ['name', 'path', 'props', 'alias', 'redirect', 'middleware'] as const
const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const

const pageContentsCache: Record<string, string> = {}
const extractCache: Record<string, Partial<Record<keyof NuxtPage, any>>> = {}
export function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys: Set<string> = new Set()): Partial<Record<keyof NuxtPage, any>> {
  // set/update pageContentsCache, invalidate extractCache on cache mismatch
  if (!(absolutePath in pageContentsCache) || pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    delete extractCache[absolutePath]
  }

  if (absolutePath in extractCache && extractCache[absolutePath]) {
    return klona(extractCache[absolutePath])
  }

  const loader = getLoader(absolutePath)
  const scriptBlocks = !loader ? null : loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader }]
  if (!scriptBlocks) {
    extractCache[absolutePath] = {}
    return {}
  }

  const extractedData: Partial<Record<keyof NuxtPage, any>> = {}

  const extractionKeys = new Set<keyof NuxtPage>([...defaultExtractionKeys, ...extraExtractionKeys as Set<keyof NuxtPage>])

  for (const script of scriptBlocks) {
    const found: Record<string, boolean> = {}
    // properties track which macros need to be extracted
    for (const macro of script.code.matchAll(PAGE_EXTRACT_RE)) {
      found[macro[1]!] = false
    }

    if (Object.keys(found).length === 0) {
      continue
    }

    const dynamicProperties = new Set<keyof NuxtPage>()

    parseAndWalk(script.code, absolutePath.replace(/\.\w+$/, '.' + script.loader), (node) => {
      if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression' || node.expression.callee.type !== 'Identifier') { return }

      // function name is one of the extracted macro functions and not yet found
      const fnName = node.expression.callee.name
      if (fnName in found === false || found[fnName] !== false) { return }
      found[fnName] = true

      let code = script.code
      let pageExtractArgument = node.expression.arguments[0]

      // TODO: always true because `extractScriptContent` only detects ts/tsx loader
      if (/tsx?/.test(script.loader)) {
        // slice, transform and parse the `define...` macro node to avoid parsing the whole file
        const transformed = transformSync(absolutePath, script.code.slice(node.start, node.end), { lang: script.loader })
        if (transformed.errors.length) {
          for (const error of transformed.errors) {
            logger.warn(`Error while transforming \`${fnName}()\`` + error.codeframe)
          }
          return
        }

        // we already know that the first statement is a call expression
        pageExtractArgument = ((parseSync('', transformed.code, { lang: 'js' }).program.body[0]! as ExpressionStatement).expression as CallExpression).arguments[0]
        code = transformed.code
      }

      if (pageExtractArgument?.type !== 'ObjectExpression') {
        logger.warn(`\`${fnName}\` must be called with an object literal (reading \`${absolutePath}\`), found ${pageExtractArgument?.type} instead.`)
        return
      }

      if (fnName === 'defineRouteRules') {
        const { value, serializable } = isSerializable(code, pageExtractArgument)
        if (!serializable) {
          logger.warn(`\`${fnName}\` must be called with a serializable object literal (reading \`${absolutePath}\`).`)
          return
        }

        extractedData.rules = value
        return
      }

      if (fnName === 'definePageMeta') {
        for (const key of extractionKeys) {
          const property = pageExtractArgument.properties.find((property): property is ObjectProperty => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === key)
          if (!property) { continue }

          const { value, serializable } = isSerializable(code, property.value)
          if (!serializable) {
            logger.debug(`Skipping extraction of \`${key}\` metadata as it is not JSON-serializable (reading \`${absolutePath}\`).`)
            dynamicProperties.add(extraExtractionKeys.has(key) ? 'meta' : key)
            continue
          }

          if (extraExtractionKeys.has(key)) {
            extractedData.meta ??= {}
            extractedData.meta[key] = value
          } else {
            extractedData[key] = value
          }
        }

        for (const property of pageExtractArgument.properties) {
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
          extractedData.meta ??= {}
          extractedData.meta[DYNAMIC_META_KEY] = dynamicProperties
        }
      }
    })
  }

  extractCache[absolutePath] = extractedData
  return klona(extractedData)
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
  if (node.type === 'ObjectExpression') {
    const valueString = code.slice(node.start, node.end)
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

  if (node.type === 'ArrayExpression') {
    const values: string[] = []
    for (const element of node.elements) {
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

  if (node.type === 'Literal' && (typeof node.value === 'string' || typeof node.value === 'boolean' || typeof node.value === 'number' || node.value === null)) {
    return {
      value: node.value,
      serializable: true,
    }
  }

  return {
    serializable: false,
  }
}

export function toRou3Patterns (pages: NuxtPage[], prefix = '/'): string[] {
  const routes: string[] = []
  for (const page of pages) {
    // convert to rou3-compatible path (https://github.com/h3js/rou3)
    const path = page.path
      // remove all regex patterns
      .replace(/\([^)]*\)/g, '')
      // catchalls: `:name([^/]*)*` or `:catchall(.*)*`
      .replace(/:(\w+)\*.*/g, (_, name) => `**:${name}`)
      // dynamic paths, including custom patterns, e.g. :id([^/]*)*/suffix
      .replace(/:([^/*]*)/g, (_, name) => `:${name.replace(/\W/g, (r: string) => r === '?' ? '' : '_')}`)

    routes.push(joinURL(prefix, path))

    if (page.children) {
      routes.push(...toRou3Patterns(page.children, joinURL(prefix, path)))
    }
  }
  return routes
}
