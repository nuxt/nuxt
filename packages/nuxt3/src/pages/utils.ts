import { basename, extname, relative, resolve } from 'pathe'
import { encodePath } from 'ufo'
import { Nuxt, resolveFiles } from '@nuxt/kit'
import { kebabCase } from 'scule'

export interface NuxtRoute {
  name?: string
  path: string
  file: string
  children: NuxtRoute[]
}

enum SegmentParserState {
  initial,
  static,
  dynamic,
  catchall,
}

enum SegmentTokenType {
  static,
  dynamic,
  catchall,
}

interface SegmentToken {
  type: SegmentTokenType
  value: string
}

export async function resolvePagesRoutes (nuxt: Nuxt) {
  const pagesDir = resolve(nuxt.options.srcDir, nuxt.options.dir.pages)
  const files = await resolveFiles(pagesDir, `**/*{${nuxt.options.extensions.join(',')}}`)

  // Sort to make sure parent are listed first
  files.sort()

  return generateRoutesFromFiles(files, pagesDir)
}

export function generateRoutesFromFiles (files: string[], pagesDir: string): NuxtRoute[] {
  const routes: NuxtRoute[] = []

  for (const file of files) {
    const segments = relative(pagesDir, file)
      .replace(new RegExp(`${extname(file)}$`), '')
      .split('/')

    const route: NuxtRoute = {
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
      const isSingleSegment = segments.length === 1
      const isLastSegment = i === segments.length - 1

      // ex: parent/[slug].vue -> parent-slug
      route.name += (route.name && '-') + segmentName

      // ex: parent.vue + parent/child.vue
      const child = parent.find(parentRoute => parentRoute.name === route.name)
      if (child) {
        parent = child.children
        route.path = ''
      } else if (segmentName === '404' && isSingleSegment) {
        route.path += '/:catchAll(.*)*'
      } else if (segmentName === 'index' && !route.path) {
        route.path += '/'
      } else if (segmentName !== 'index') {
        route.path += getRoutePath(tokens)
        if (isLastSegment && tokens.length === 1 && tokens[0].type === SegmentTokenType.dynamic) {
          route.path += '?'
        }
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
      (token.type === SegmentTokenType.dynamic
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
        if (buffer === '...') {
          buffer = ''
          state = SegmentParserState.catchall
        }
        if (c === ']') {
          consumeBuffer()
          state = SegmentParserState.initial
        } else if (PARAM_CHAR_RE.test(c)) {
          buffer += c
        } else {
          // eslint-disable-next-line no-console
          console.log(`Ignored character "${c}" while building param "${buffer}" from "segment"`)
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

function prepareRoutes (routes: NuxtRoute[], parent?: NuxtRoute) {
  for (const route of routes) {
    // Remove -index
    if (route.name) {
      route.name = route.name.replace(/-index$/, '')
    }

    if (route.path === '/') {
      // Remove ? suffix when index page at same level
      routes.forEach((siblingRoute) => {
        if (siblingRoute.path.endsWith('?')) {
          siblingRoute.path = siblingRoute.path.slice(0, -1)
        }
      })
    }
    // Remove leading / if children route
    if (parent && route.path.startsWith('/')) {
      route.path = route.path.slice(1)
    }

    if (route.children.length) {
      route.children = prepareRoutes(route.children, route)
    }

    if (route.children.find(childRoute => childRoute.path === '')) {
      delete route.name
    }
  }

  return routes
}

export async function resolveLayouts (nuxt: Nuxt) {
  const layoutDir = resolve(nuxt.options.srcDir, nuxt.options.dir.layouts)
  const files = await resolveFiles(layoutDir, `*{${nuxt.options.extensions.join(',')}}`)

  return files.map((file) => {
    const name = kebabCase(basename(file).replace(extname(file), '')).replace(/["']/g, '')
    return { name, file }
  })
}
