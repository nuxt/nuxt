import { extname, normalize, relative, resolve } from 'pathe'
import { encodePath } from 'ufo'
import type { NuxtPage } from '@nuxt/schema'
import { resolveFiles, useNuxt } from '@nuxt/kit'
import { genImport, genDynamicImport, genArrayFromRaw, genSafeVariableName } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'
import { uniqueBy } from '../core/utils'

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

export async function resolvePagesRoutes (): Promise<NuxtPage[]> {
  const nuxt = useNuxt()

  const pagesDirs = nuxt.options._layers.map(
    layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
  )

  const allRoutes = (await Promise.all(
    pagesDirs.map(async (dir) => {
      const files = await resolveFiles(dir, `**/*{${nuxt.options.extensions.join(',')}}`)
      // Sort to make sure parent are listed first
      files.sort()
      return generateRoutesFromFiles(files, dir)
    })
  )).flat()

  return uniqueBy(allRoutes, 'path')
}

export function generateRoutesFromFiles (files: string[], pagesDir: string): NuxtPage[] {
  const routes: NuxtPage[] = []

  for (const file of files) {
    const segments = relative(pagesDir, file)
      .replace(new RegExp(`${escapeRE(extname(file))}$`), '')
      .split('/')

    const route: NuxtPage = {
      name: '',
      path: '',
      file,
      children: []
    }

    // Array where routes should be added, useful when adding child routes
    let parent = routes

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      const tokens = parseSegment(segment)
      const segmentName = tokens.map(({ value }) => value).join('')

      // ex: parent/[slug].vue -> parent-slug
      route.name += (route.name && '-') + segmentName

      // ex: parent.vue + parent/child.vue
      const child = parent.find(parentRoute => parentRoute.name === route.name && !parentRoute.path.endsWith('(.*)*'))

      if (child && child.children) {
        parent = child.children
        route.path = ''
      } else if (segmentName === 'index' && !route.path) {
        route.path += '/'
      } else if (segmentName !== 'index') {
        route.path += getRoutePath(tokens)
      }
    }

    parent.push(route)
  }

  return prepareRoutes(routes)
}

function getRoutePath (tokens: SegmentToken[]): string {
  return tokens.reduce((path, token) => {
    return (
      path +
      (token.type === SegmentTokenType.optional
        ? `:${token.value}?`
        : token.type === SegmentTokenType.dynamic
          ? `:${token.value}`
          : token.type === SegmentTokenType.catchall
            ? `:${token.value}(.*)*`
            : encodePath(token.value))
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
        if (c === ']' && (state !== SegmentParserState.optional || buffer[buffer.length - 1] === ']')) {
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

function prepareRoutes (routes: NuxtPage[], parent?: NuxtPage) {
  for (const route of routes) {
    // Remove -index
    if (route.name) {
      route.name = route.name.replace(/-index$/, '')
    }

    // Remove leading / if children route
    if (parent && route.path.startsWith('/')) {
      route.path = route.path.slice(1)
    }

    if (route.children?.length) {
      route.children = prepareRoutes(route.children, route)
    }

    if (route.children?.find(childRoute => childRoute.path === '')) {
      delete route.name
    }
  }

  return routes
}

export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set()): { imports: Set<string>, routes: string } {
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const file = normalize(page.file)
      const metaImportName = genSafeVariableName(filename(file) + hash(file)) + 'Meta'
      metaImports.add(genImport(`${file}?macro=true`, [{ name: 'default', as: metaImportName }]))

      let aliasCode = `${metaImportName}?.alias || []`
      if (Array.isArray(page.alias) && page.alias.length) {
        aliasCode = `${JSON.stringify(page.alias)}.concat(${aliasCode})`
      }

      const route = {
        ...Object.fromEntries(Object.entries(page).map(([key, value]) => [key, JSON.stringify(value)])),
        file: undefined,
        name: `${metaImportName}?.name ?? ${page.name ? JSON.stringify(page.name) : 'undefined'}`,
        path: `${metaImportName}?.path ?? ${JSON.stringify(page.path)}`,
        children: page.children ? normalizeRoutes(page.children, metaImports).routes : [],
        meta: page.meta ? `{...(${metaImportName} || {}), ...${JSON.stringify(page.meta)}}` : metaImportName,
        alias: aliasCode,
        redirect: page.redirect ? JSON.stringify(page.redirect) : `${metaImportName}?.redirect || undefined`,
        component: genDynamicImport(file, { interopDefault: true })
      }

      delete route.file

      return route
    }))
  }
}
