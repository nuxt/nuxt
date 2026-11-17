import type { IncomingMessage } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { DevEnvironment } from 'vite'
import { isNavigationRequest, warmupViteServer } from '../src/utils/warmup.ts'

const root = '/project'

interface FakeModule {
  url: string
  imports: string[]
}

function createEnvironment (graph: Record<string, string[]>) {
  const transformed: string[] = []
  const modules = new Map<string, FakeModule & { transformResult: { code: string } | null }>()

  const environment = {
    moduleGraph: {
      getModuleByUrl: (url: string) => {
        const mod = modules.get(url)
        if (!mod) { return Promise.resolve(undefined) }
        return Promise.resolve({
          transformResult: mod.transformResult,
          importedModules: new Set(mod.imports.map(url => ({ url }))),
        })
      },
    },
    transformRequest: (url: string) => {
      transformed.push(url)
      modules.set(url, { url, imports: graph[url] || [], transformResult: { code: '' } })
      return Promise.resolve({ code: '' })
    },
  } as unknown as DevEnvironment

  for (const url of Object.keys(graph)) {
    modules.set(url, { url, imports: graph[url]!, transformResult: null })
  }

  return { environment, transformed }
}

describe('warmupViteServer', () => {
  it.each([
    {
      name: 'the entry\'s transitive imports',
      graph: { '/app/entry.js': ['/app/a.js', '/app/b.js'], '/app/a.js': ['/app/c.js'], '/app/b.js': ['/app/c.js'], '/app/c.js': [] },
      expected: ['/app/a.js', '/app/b.js', '/app/c.js', '/app/entry.js'],
    },
    {
      name: 'imports without the base and vite url decorations',
      graph: { '/app/entry.js': ['/base/app/a.js', '/base/@id/virtual:thing', '/base/app/b.js?import='], '/app/a.js': [], 'virtual:thing': [], '/app/b.js': [] },
      options: { base: '/base/' },
      expected: ['/app/a.js', '/app/b.js', '/app/entry.js', 'virtual:thing'],
    },
    {
      name: 'imports without `import`, keeping the remaining query',
      graph: {
        '/app/entry.js': ['/app/a.js?import&t=1', '/app/b.js?import=&v=2', '/app/c.vue?vue&type=style&index=0&lang.css', '/app/d.js?'],
        '/app/a.js?t=1': [],
        '/app/b.js?v=2': [],
        '/app/c.vue?vue&type=style&index=0&lang.css': [],
        '/app/d.js': [],
      },
      expected: ['/app/a.js?t=1', '/app/b.js?v=2', '/app/c.vue?vue&type=style&index=0&lang.css', '/app/d.js', '/app/entry.js'],
    },
    {
      name: 'an /@fs/ url for entries outside the root',
      graph: { '/@fs/elsewhere/entry.js': [] },
      entry: '/elsewhere/entry.js',
      expected: ['/@fs/elsewhere/entry.js'],
    },
    {
      name: 'css requests without following their imports',
      graph: { '/app/entry.js': ['/app/style.css'], '/app/style.css': ['/app/nested.js'], '/app/nested.js': [] },
      expected: ['/app/entry.js', '/app/style.css'],
    },
  ] as Array<{ name: string, graph: Record<string, string[]>, entry?: string, options?: { base?: string }, expected: string[] }>)('should transform $name', async ({ graph, entry = `${root}/app/entry.js`, options, expected }) => {
    const { environment, transformed } = createEnvironment(graph)

    const result = await warmupViteServer(environment, [entry], { root, ...options })

    expect(transformed.sort()).toStrictEqual(expected)
    expect(result).toMatchObject({ modules: expected.length, stopped: false })
  })

  it('should handle cycles and already-transformed modules', async () => {
    const { environment, transformed } = createEnvironment({
      '/app/entry.js': ['/app/a.js'],
      '/app/a.js': ['/app/entry.js'],
    })

    await warmupViteServer(environment, [`${root}/app/entry.js`], { root })
    await warmupViteServer(environment, [`${root}/app/entry.js`], { root })

    expect(transformed).toStrictEqual(['/app/entry.js', '/app/a.js'])
  })

  it('should transform modules in parallel', async () => {
    const { environment } = createEnvironment({
      '/app/entry.js': ['/app/a.js', '/app/b.js', '/app/c.js', '/app/d.js'],
      '/app/a.js': [],
      '/app/b.js': [],
      '/app/c.js': [],
      '/app/d.js': [],
    })

    let active = 0
    let maxActive = 0
    const transformRequest = environment.transformRequest
    vi.spyOn(environment, 'transformRequest').mockImplementation(async (url) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 10))
      active--
      return transformRequest(url)
    })

    const result = await warmupViteServer(environment, [`${root}/app/entry.js`], { root, concurrency: 4 })

    expect(maxActive).toBe(4)
    expect(result.modules).toBe(5)
  })

  it('should idle while paused rather than transforming', async () => {
    const { environment, transformed } = createEnvironment({
      '/app/entry.js': ['/app/a.js'],
      '/app/a.js': [],
    })

    let paused = true
    const result = warmupViteServer(environment, [`${root}/app/entry.js`], {
      root,
      maxDuration: 5000,
      shouldPause: () => paused,
    })

    await new Promise(resolve => setTimeout(resolve, 60))
    expect(transformed).toStrictEqual([])

    paused = false
    expect((await result).stopped).toBe(false)
    expect(transformed.sort()).toStrictEqual(['/app/a.js', '/app/entry.js'])
  })

  it('should not count already-transformed modules towards the module bound', async () => {
    const { environment } = createEnvironment({
      '/app/entry.js': ['/app/a.js'],
      '/app/a.js': ['/app/b.js'],
      '/app/b.js': [],
    })

    await warmupViteServer(environment, [`${root}/app/entry.js`], { root, maxModules: 1, concurrency: 1 })
    const result = await warmupViteServer(environment, [`${root}/app/entry.js`], { root, maxModules: 1, concurrency: 1 })

    expect(result.modules).toBe(1)
    expect(result.visited).toBe(2)
  })

  it('should stop at the module bound', async () => {
    const { environment, transformed } = createEnvironment({
      '/app/entry.js': ['/app/a.js', '/app/b.js', '/app/c.js'],
      '/app/a.js': [],
      '/app/b.js': [],
      '/app/c.js': [],
    })

    const result = await warmupViteServer(environment, [`${root}/app/entry.js`], { root, maxModules: 2, concurrency: 1 })

    expect(transformed.length).toBe(2)
    expect(result.stopped).toBe(true)
  })

  it('should abandon the crawl when a request arrives', async () => {
    const { environment, transformed } = createEnvironment({
      '/app/entry.js': ['/app/a.js', '/app/b.js'],
      '/app/a.js': [],
      '/app/b.js': [],
    })

    let requested = false
    const transformRequest = environment.transformRequest
    vi.spyOn(environment, 'transformRequest').mockImplementation((url) => {
      requested = true
      return transformRequest(url)
    })

    const result = await warmupViteServer(environment, [`${root}/app/entry.js`], {
      root,
      concurrency: 1,
      shouldStop: () => requested,
    })

    expect(transformed).toStrictEqual(['/app/entry.js'])
    expect(result.stopped).toBe(true)
  })

  it('should survive a failing transform', async () => {
    const { environment, transformed } = createEnvironment({
      '/app/entry.js': ['/app/a.js', '/app/b.js'],
      '/app/a.js': [],
      '/app/b.js': [],
    })
    const transformRequest = environment.transformRequest
    vi.spyOn(environment, 'transformRequest').mockImplementation((url) => {
      if (url === '/app/a.js') { return Promise.reject(new Error('boom')) }
      return transformRequest(url)
    })

    const result = await warmupViteServer(environment, [`${root}/app/entry.js`], { root })

    expect(transformed).toContain('/app/b.js')
    expect(result.stopped).toBe(false)
  })
})

describe('isNavigationRequest', () => {
  const request = (headers: Record<string, string>) => ({ headers } as unknown as IncomingMessage)

  it.each([
    [{ 'sec-fetch-mode': 'navigate', 'accept': '*/*' }, true],
    [{ 'sec-fetch-mode': 'cors', 'accept': 'text/html' }, false],
    [{ 'sec-fetch-mode': 'no-cors' }, false],
    [{ accept: 'text/html,application/xhtml+xml' }, true],
    [{ accept: '*/*' }, false],
    [{}, false],
  ])('should detect %o as %s', (headers, expected) => {
    expect(isNavigationRequest(request(headers))).toBe(expected)
  })
})
