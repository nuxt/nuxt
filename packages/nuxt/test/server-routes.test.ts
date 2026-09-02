import { describe, expect, it } from 'vitest'
import type { Nuxt, ServerRouteHandler, ServerRouteSegment } from 'nuxt/schema'

import { ALL_METHODS, buildServerRoutes, collectPageRoutes, collectServerRoutes, resolveServerRoutes } from '../src/core/utils/server-routes'

const dynamic = { type: 'dynamic' } as const
const wildcard = { type: 'wildcard' } as const
function path (value: string): ServerRouteSegment {
  return { type: 'static', value }
}

describe('collectServerRoutes', () => {
  it('groups handlers by route and method', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/hey')], route: '/api/hey', method: 'get', handler: '/s/hey/index.get.ts' },
      { segments: [path('/api/hey')], route: '/api/hey', method: 'post', handler: '/s/hey/index.post.ts' },
    ])).toEqual([
      {
        segments: [path('/api/hey')],
        routes: ['/api/hey'],
        handlers: { get: ['/s/hey/index.get.ts'], post: ['/s/hey/index.post.ts'] },
      },
    ])
  })

  it('keys handlers without a method as answering every method', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/hello')], handler: '/s/hello.ts' },
    ])).toEqual([
      { segments: [path('/api/hello')], routes: [], handlers: { [ALL_METHODS]: ['/s/hello.ts'] } },
    ])
  })

  it('normalises method case', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/hey')], method: 'POST', handler: '/s/hey.post.ts' },
    ])[0]!.handlers).toEqual({ post: ['/s/hey.post.ts'] })
  })

  it('unions handlers that the router cannot tell apart', () => {
    const routes = collectServerRoutes([
      { segments: [path('/api/users'), dynamic], route: '/api/users/:id(\\d+)', method: 'get', handler: '/by-id.ts' },
      { segments: [path('/api/users'), dynamic], route: '/api/users/:slug([a-z]+)', method: 'get', handler: '/by-slug.ts' },
    ])

    expect(routes).toHaveLength(1)
    expect(routes[0]!.handlers).toEqual({ get: ['/by-id.ts', '/by-slug.ts'] })
    expect(routes[0]!.routes).toEqual(['/api/users/:id(\\d+)', '/api/users/:slug([a-z]+)'])
  })

  it('deduplicates a handler registered twice', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/hey')], method: 'get', handler: '/a.ts' },
      { segments: [path('/api/hey')], method: 'get', handler: '/a.ts' },
    ])[0]!.handlers).toEqual({ get: ['/a.ts'] })
  })

  it('keeps patterns apart when they match differently', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/posts'), dynamic], method: 'get', handler: '/dynamic.ts' },
      { segments: [path('/api/posts/static')], method: 'get', handler: '/static.ts' },
      { segments: [path('/api/files'), wildcard], method: 'get', handler: '/wildcard.ts' },
      { segments: [path('/api/a'), dynamic, path('/b'), dynamic, path('/c')], method: 'get', handler: '/nested.ts' },
    ])).toHaveLength(4)
  })

  it('drops middleware and handlers without segments or a file', () => {
    expect(collectServerRoutes([
      { segments: [path('/api/logger')], handler: '/s/logger.ts', middleware: true },
      { segments: [], handler: '/s/orphan.ts' },
      { segments: [path('/api/no-file')], handler: '' },
    ])).toEqual([])
  })

  it('sorts routes and methods so unchanged projects regenerate unchanged types', () => {
    const handlers: ServerRouteHandler[] = [
      { segments: [path('/api/b')], method: 'post', handler: '/b.post.ts' },
      { segments: [path('/api/a')], method: 'get', handler: '/a.get.ts' },
      { segments: [path('/api/b')], method: 'get', handler: '/b.get.ts' },
    ]
    const first = collectServerRoutes(handlers)
    const second = collectServerRoutes([handlers[2]!, handlers[0]!, handlers[1]!])

    expect(first.map(r => r.segments)).toEqual([[path('/api/a')], [path('/api/b')]])
    expect(Object.keys(first[1]!.handlers)).toEqual(['get', 'post'])
    expect(second).toEqual(first)
  })
})

describe('resolveServerRoutes', () => {
  function fakeNuxt (contributed: ServerRouteHandler[]) {
    return {
      callHook: (name: string, routes: ServerRouteHandler[]) => {
        if (name === 'server:routes') { routes.push(...contributed) }
        return Promise.resolve()
      },
    } as unknown as Nuxt
  }

  it('collects the routes the server builder contributes', async () => {
    expect((await resolveServerRoutes(fakeNuxt([
      { segments: [path('/api/scanned')], route: '/api/scanned', method: 'get', handler: '/scanned.get.ts' },
    ]))).routes).toEqual([
      { segments: [path('/api/scanned')], routes: ['/api/scanned'], handlers: { get: ['/scanned.get.ts'] } },
    ])
  })

  it('resolves to nothing when no builder answers', async () => {
    expect((await resolveServerRoutes(fakeNuxt([]))).routes).toEqual([])
  })

  it('passes on how the builder reads request shapes', async () => {
    const nuxt = {
      callHook: (name: string, _routes: ServerRouteHandler[], context: { requestTypes?: { module: string } }) => {
        if (name === 'server:routes') { context.requestTypes = { module: '@builder/request-types' } }
        return Promise.resolve()
      },
    } as unknown as Nuxt

    expect((await resolveServerRoutes(nuxt)).requestTypes).toEqual({ module: '@builder/request-types' })
  })
})

describe('buildServerRoutes', () => {
  const typesDir = '/project/.nuxt/types'

  function routes (input: Parameters<typeof buildServerRoutes>[0]) {
    return buildServerRoutes(input, typesDir)
  }

  it('passes segments through as the builder reported them', () => {
    expect(routes([
      { segments: [path('/api/a')], routes: [], handlers: { get: ['/project/server/api/a.get.ts'] } },
    ])[0]!.segments).toEqual([path('/api/a')])
  })

  it('describes responses as the serialized return type of the handler', () => {
    expect(routes([
      { segments: [path('/api/a')], routes: [], handlers: { get: ['/project/server/api/a.get.ts'] } },
    ])[0]!.metadata).toEqual({
      GET: { responseType: 'Serialize<Awaited<ReturnType<typeof import("../../server/api/a.get").default>>>' },
    })
  })

  it('unions handlers registered for the same route and method', () => {
    const [route] = routes([
      { segments: [path('/api/a')], routes: [], handlers: { get: ['/project/server/one.ts', '/project/server/two.ts'] } },
    ])
    expect(route!.metadata!.GET!.responseType).toBe(
      'Serialize<Awaited<ReturnType<typeof import("../../server/one").default>>> | Serialize<Awaited<ReturnType<typeof import("../../server/two").default>>>',
    )
  })

  it('collapses handlers answering every method into a single entry', () => {
    expect(Object.keys(routes([
      { segments: [path('/api/a')], routes: [], handlers: { [ALL_METHODS]: ['/project/server/a.ts'] } },
    ])[0]!.metadata!)).toEqual(['ALL'])
  })

  it('emits one route per pattern, leaving catch-all prefixes to the compiler', () => {
    expect(routes([
      { segments: [path('/api/files'), wildcard], routes: [], handlers: { get: ['/project/server/files.ts'] } },
    ]).map(r => r.segments)).toEqual([[path('/api/files'), wildcard]])
  })

  it('leaves ambiguity between a parameter and its static siblings to the compiler', () => {
    const built = routes([
      { segments: [path('/api/posts'), dynamic], routes: [], handlers: { get: ['/project/server/[id].ts'] } },
      { segments: [path('/api/posts/static')], routes: [], handlers: { get: ['/project/server/static.ts'] } },
    ])
    for (const route of built) {
      expect(Object.keys(route.metadata!.GET!)).toEqual(['responseType'])
    }
  })

  it('describes request shapes with the types the builder declared', () => {
    const requestTypes = { module: '@builder/request-types', body: 'BodyOf', query: 'QueryOf' }
    const [route] = buildServerRoutes([
      { segments: [path('/api/a')], routes: [], handlers: { post: ['/project/server/a.post.ts'] } },
    ], typesDir, requestTypes)

    expect(route!.metadata!.POST).toEqual({
      responseType: 'Serialize<Awaited<ReturnType<typeof import("../../server/a.post").default>>>',
      bodyType: 'BodyOf<typeof import("../../server/a.post").default>',
      queryType: 'QueryOf<typeof import("../../server/a.post").default>',
    })
  })

  it('omits request shapes when the builder declares none', () => {
    const [route] = routes([
      { segments: [path('/api/a')], routes: [], handlers: { post: ['/project/server/a.post.ts'] } },
    ])

    expect(Object.keys(route!.metadata!.POST!)).toEqual(['responseType'])
  })

  it('cannot describe a request served by several handlers at once', () => {
    const [route] = buildServerRoutes([
      { segments: [path('/api/a')], routes: [], handlers: { post: ['/project/server/one.ts', '/project/server/two.ts'] } },
    ], typesDir, { module: '@builder/request-types', body: 'BodyOf' })

    expect(route!.metadata!.POST!.bodyType).toBeUndefined()
  })
})

describe('collectPageRoutes', () => {
  it('describes a page as a GET route', () => {
    expect(collectPageRoutes([{ path: '/about', file: '/app/pages/about.vue' }])).toEqual([
      { segments: [path('/about')], route: '/about', method: 'get', handler: '/app/pages/about.vue' },
    ])
  })

  it('maps a parameter and a catch-all to the segments the schema is emitted from', () => {
    expect(collectPageRoutes([
      { path: '/users/:id', file: '/a.vue' },
      { path: '/docs/:slug(.*)*', file: '/b.vue' },
    ]).map(r => r.segments)).toEqual([
      [path('/users'), dynamic],
      [path('/docs'), wildcard],
    ])
  })

  it('joins a relative child onto its parent, and leaves an absolute one alone', () => {
    expect(collectPageRoutes([
      {
        path: '/parent',
        file: '/parent.vue',
        children: [
          { path: 'child', file: '/child.vue' },
          { path: '/absolute', file: '/absolute.vue' },
        ],
      },
    ]).map(r => r.route)).toEqual(['/parent', '/parent/child', '/absolute'])
  })

  it('expands an optional parameter into the routes it matches', () => {
    expect(collectPageRoutes([{ path: '/posts/:id?', file: '/a.vue' }]).map(r => r.route))
      .toEqual(['/posts/:id', '/posts'])
  })

  it('describes each alias of a page as a route of its own', () => {
    expect(collectPageRoutes([
      { path: '/about', alias: '/about-us', file: '/about.vue' },
      { path: '/posts/:id?', alias: ['/articles/:id?', '/p/:id'], file: '/post.vue' },
    ]).map(r => r.route)).toEqual([
      '/about',
      '/about-us',
      '/posts/:id',
      '/posts',
      '/articles/:id',
      '/articles',
      '/p/:id',
    ])
  })

  it('joins a relative alias onto its parent, as vue-router does', () => {
    expect(collectPageRoutes([
      {
        path: '/parent',
        file: '/parent.vue',
        children: [
          { path: 'child', alias: 'kid', file: '/child.vue' },
        ],
      },
    ]).map(r => r.route)).toEqual(['/parent', '/parent/child', '/parent/kid'])
  })

  it('skips a page with no file, since there is nothing to answer with', () => {
    expect(collectPageRoutes([{ path: '/no-file' }])).toEqual([])
  })

  it('describes the index page as the root', () => {
    expect(collectPageRoutes([{ path: '/', file: '/index.vue' }])[0]!.segments).toEqual([path('/')])
  })
})
