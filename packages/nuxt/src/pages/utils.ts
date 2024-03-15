import { runInNewContext } from 'node:vm'
import fs from 'node:fs'
import { extname, normalize, relative, resolve } from 'pathe'
import { encodePath, joinURL, withLeadingSlash } from 'ufo'
import { logger, resolveFiles, useNuxt } from '@nuxt/kit'
import { genArrayFromRaw, genDynamicImport, genImport, genSafeVariableName } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'
import { transform } from 'esbuild'
import { parse } from 'acorn'
import type { CallExpression, ExpressionStatement, ObjectExpression, Program, Property } from 'estree'
import type { NuxtPage } from 'nuxt/schema'

import { uniqueBy } from '../core/utils'
import { toArray } from '../utils'
import { distDir } from '../dirs'

enum SegmentParserState {
  initial,
  static,
  dynamic,
  optional,
  catchall,
}

enum SegmentTokenType {
  static,
  dynamic,
  optional,
  catchall,
}

interface SegmentToken {
  type: SegmentTokenType
  value: string
}

interface ScannedFile {
  relativePath: string
  absolutePath: string
}

export async function resolvePagesRoutes (): Promise<NuxtPage[]> {
  const nuxt = useNuxt()

  const pagesDirs = nuxt.options._layers.map(
    layer => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || 'pages')
  )

  const scannedFiles: ScannedFile[] = []
  for (const dir of pagesDirs) {
    const files = await resolveFiles(dir, `**/*{${nuxt.options.extensions.join(',')}}`)
    scannedFiles.push(...files.map(file => ({ relativePath: relative(dir, file), absolutePath: file })))
  }

  // sort scanned files using en-US locale to make the result consistent across different system locales
  scannedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en-US'))

  const allRoutes = await generateRoutesFromFiles(uniqueBy(scannedFiles, 'relativePath'), {
    shouldExtractBuildMeta: nuxt.options.experimental.scanPageMeta || nuxt.options.experimental.typedPages,
    shouldUseServerComponents: !!nuxt.options.experimental.componentIslands,
    vfs: nuxt.vfs
  })

  return uniqueBy(allRoutes, 'path')
}

type GenerateRoutesFromFilesOptions = {
  shouldExtractBuildMeta?: boolean
  shouldUseServerComponents?: boolean
  vfs?: Record<string, string>
}

export async function generateRoutesFromFiles (files: ScannedFile[], options: GenerateRoutesFromFilesOptions = {}): Promise<NuxtPage[]> {
  const routes: NuxtPage[] = []

  for (const file of files) {
    const segments = file.relativePath
      .replace(new RegExp(`${escapeRE(extname(file.relativePath))}$`), '')
      .split('/')

    const route: NuxtPage = {
      name: '',
      path: '',
      file: file.absolutePath,
      children: []
    }

    // Array where routes should be added, useful when adding child routes
    let parent = routes

    const lastSegment = segments[segments.length - 1]
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

      const tokens = parseSegment(segment)
      const segmentName = tokens.map(({ value }) => value).join('')

      // ex: parent/[slug].vue -> parent-slug
      route.name += (route.name && '/') + segmentName

      // ex: parent.vue + parent/child.vue
      const path = withLeadingSlash(joinURL(route.path, getRoutePath(tokens).replace(/\/index$/, '/')))
      const child = parent.find(parentRoute => parentRoute.name === route.name && parentRoute.path === path)

      if (child && child.children) {
        parent = child.children
        route.path = ''
      } else if (segmentName === 'index' && !route.path) {
        route.path += '/'
      } else if (segmentName !== 'index') {
        route.path += getRoutePath(tokens)
      }
    }

    if (options.shouldExtractBuildMeta && options.vfs) {
      const fileContent = file.absolutePath in options.vfs ? options.vfs[file.absolutePath] : fs.readFileSync(file.absolutePath, 'utf-8')
      Object.assign(route, await getRouteMeta(fileContent, file.absolutePath))
    }

    parent.push(route)
  }

  return prepareRoutes(routes)
}

const SFC_SCRIPT_RE = /<script\s*[^>]*>([\s\S]*?)<\/script\s*[^>]*>/i
export function extractScriptContent (html: string) {
  const match = html.match(SFC_SCRIPT_RE)

  if (match && match[1]) {
    return match[1].trim()
  }

  return null
}

const PAGE_META_RE = /(definePageMeta\([\s\S]*?\))/
const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const

const pageContentsCache: Record<string, string> = {}
const metaCache: Record<string, Partial<Record<keyof NuxtPage, any>>> = {}
async function getRouteMeta (contents: string, absolutePath: string): Promise<Partial<Record<keyof NuxtPage, any>>> {
  // set/update pageContentsCache, invalidate metaCache on cache mismatch
  if (!(absolutePath in pageContentsCache) || pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    delete metaCache[absolutePath]
  }

  if (absolutePath in metaCache) { return metaCache[absolutePath] }

  const script = extractScriptContent(contents)
  if (!script) {
    metaCache[absolutePath] = {}
    return {}
  }

  if (!PAGE_META_RE.test(script)) {
    metaCache[absolutePath] = {}
    return {}
  }

  const js = await transform(script, { loader: 'ts' })
  const ast = parse(js.code, {
    sourceType: 'module',
    ecmaVersion: 'latest',
    ranges: true
  }) as unknown as Program
  const pageMetaAST = ast.body.find(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' && node.expression.callee.type === 'Identifier' && node.expression.callee.name === 'definePageMeta')
  if (!pageMetaAST) {
    metaCache[absolutePath] = {}
    return {}
  }

  const pageMetaArgument = ((pageMetaAST as ExpressionStatement).expression as CallExpression).arguments[0] as ObjectExpression
  const extractedMeta = {} as Partial<Record<keyof NuxtPage, any>>
  const extractionKeys = ['name', 'path', 'alias', 'redirect'] as const
  const dynamicProperties = new Set<keyof NuxtPage>()

  for (const key of extractionKeys) {
    const property = pageMetaArgument.properties.find(property => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === key) as Property
    if (!property) { continue }

    if (property.value.type === 'ObjectExpression') {
      const valueString = js.code.slice(property.value.range![0], property.value.range![1])
      try {
        extractedMeta[key] = JSON.parse(runInNewContext(`JSON.stringify(${valueString})`, {}))
      } catch {
        console.debug(`[nuxt] Skipping extraction of \`${key}\` metadata as it is not JSON-serializable (reading \`${absolutePath}\`).`)
        dynamicProperties.add(key)
        continue
      }
    }

    if (property.value.type === 'ArrayExpression') {
      const values = []
      for (const element of property.value.elements) {
        if (!element) {
          continue
        }
        if (element.type !== 'Literal' || typeof element.value !== 'string') {
          console.debug(`[nuxt] Skipping extraction of \`${key}\` metadata as it is not an array of string literals (reading \`${absolutePath}\`).`)
          dynamicProperties.add(key)
          continue
        }
        values.push(element.value)
      }
      extractedMeta[key] = values
      continue
    }

    if (property.value.type !== 'Literal' || typeof property.value.value !== 'string') {
      console.debug(`[nuxt] Skipping extraction of \`${key}\` metadata as it is not a string literal or array of string literals (reading \`${absolutePath}\`).`)
      dynamicProperties.add(key)
      continue
    }
    extractedMeta[key] = property.value.value
  }

  const extraneousMetaKeys = pageMetaArgument.properties
    .filter(property => property.type === 'Property' && property.key.type === 'Identifier' && !(extractionKeys as unknown as string[]).includes(property.key.name))
    // @ts-expect-error inferred types have been filtered out
    .map(property => property.key.name)

  if (extraneousMetaKeys.length) {
    dynamicProperties.add('meta')
  }

  if (dynamicProperties.size) {
    extractedMeta.meta ??= {}
    extractedMeta.meta[DYNAMIC_META_KEY] = dynamicProperties
  }

  metaCache[absolutePath] = extractedMeta
  return extractedMeta
}

function getRoutePath (tokens: SegmentToken[]): string {
  return tokens.reduce((path, token) => {
    return (
      path +
      (token.type === SegmentTokenType.optional
        ? `:${token.value}?`
        : token.type === SegmentTokenType.dynamic
          ? `:${token.value}()`
          : token.type === SegmentTokenType.catchall
            ? `:${token.value}(.*)*`
            : encodePath(token.value).replace(/:/g, '\\:'))
    )
  }, '/')
}

const PARAM_CHAR_RE = /[\w\d_.]/

function parseSegment (segment: string) {
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
              : SegmentTokenType.catchall,
      value: buffer
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
        } else {
          i--
          state = SegmentParserState.static
        }
        break

      case SegmentParserState.static:
        if (c === '[') {
          consumeBuffer()
          state = SegmentParserState.dynamic
        } else {
          buffer += c
        }
        break

      case SegmentParserState.catchall:
      case SegmentParserState.dynamic:
      case SegmentParserState.optional:
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
        } else if (PARAM_CHAR_RE.test(c)) {
          buffer += c
        } else {

          // console.debug(`[pages]Ignored character "${c}" while building param "${buffer}" from "segment"`)
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

function prepareRoutes (routes: NuxtPage[], parent?: NuxtPage, names = new Set<string>()) {
  for (const route of routes) {
    // Remove -index
    if (route.name) {
      route.name = route.name
        .replace(/\/index$/, '')
        .replace(/\//g, '-')

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
export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set(), overrideMeta = false): { imports: Set<string>, routes: string } {
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
        name: serializeRouteValue(page.name),
        meta: serializeRouteValue(metaFiltered, skipMeta),
        alias: serializeRouteValue(toArray(page.alias), skipAlias),
        redirect: serializeRouteValue(page.redirect)
      }

      for (const key of ['path', 'name', 'meta', 'alias', 'redirect'] satisfies NormalizedRouteKeys) {
        if (route[key] === undefined) {
          delete route[key]
        }
      }

      if (page.children?.length) {
        route.children = normalizeRoutes(page.children, metaImports, overrideMeta).routes
      }

      // Without a file, we can't use `definePageMeta` to extract route-level meta from the file
      if (!page.file) {
        return route
      }

      const file = normalize(page.file)
      const metaImportName = genSafeVariableName(filename(file) + hash(file)) + 'Meta'
      metaImports.add(genImport(`${file}?macro=true`, [{ name: 'default', as: metaImportName }]))

      const metaRoute: NormalizedRoute = {
        name: `${metaImportName}?.name ?? ${route.name}`,
        path: `${metaImportName}?.path ?? ${route.path}`,
        meta: `${metaImportName} || {}`,
        alias: `${metaImportName}?.alias || []`,
        redirect: `${metaImportName}?.redirect`,
        component: page.mode === 'server'
          ? `() => createIslandPage(${route.name})`
          : page.mode === 'client'
            ? `() => createClientPage(${genDynamicImport(file, { interopDefault: true })})`
            : genDynamicImport(file, { interopDefault: true })
      }

      if (page.mode === 'server') {
        metaImports.add(`
let _createIslandPage
async function createIslandPage (name) {
  _createIslandPage ||= await import(${JSON.stringify(resolve(distDir, 'components/runtime/server-component'))}).then(r => r.createIslandPage)
  return _createIslandPage(name)
};`)
      } else if (page.mode === 'client') {
        metaImports.add(`
let _createClientPage
async function createClientPage(loader) {
  _createClientPage ||= await import(${JSON.stringify(resolve(distDir, 'components/runtime/client-component'))}).then(r => r.createClientPage)
  return _createClientPage(loader);
}`)
      }

      if (route.children != null) {
        metaRoute.children = route.children
      }

      if (overrideMeta) {
        metaRoute.name = `${metaImportName}?.name`
        metaRoute.path = `${metaImportName}?.path ?? ''`

        // skip and retain fallback if marked dynamic
        // set to extracted value or fallback if none extracted
        for (const key of ['name', 'path'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }
          metaRoute[key] = route[key] ?? metaRoute[key]
        }

        // set to extracted value or delete if none extracted
        for (const key of ['meta', 'alias', 'redirect'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }

          if (route[key] == null) {
            delete metaRoute[key]
            continue
          }

          metaRoute[key] = route[key]
        }
      } else {
        if (route.meta != null) {
          metaRoute.meta = `{ ...(${metaImportName} || {}), ...${route.meta} }`
        }

        if (route.alias != null) {
          metaRoute.alias = `${route.alias}.concat(${metaImportName}?.alias || [])`
        }

        if (route.redirect != null) {
          metaRoute.redirect = route.redirect
        }
      }

      return metaRoute
    }))
  }
}

export function pathToNitroGlob (path: string) {
  if (!path) {
    return null
  }
  // Ignore pages with multiple dynamic parameters.
  if (path.indexOf(':') !== path.lastIndexOf(':')) {
    return null
  }

  return path.replace(/\/(?:[^:/]+)?:\w+.*$/, '/**')
}
