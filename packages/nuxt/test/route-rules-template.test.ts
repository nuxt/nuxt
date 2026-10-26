import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'
import type { NuxtPage } from '../schema.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

async function getRouteRulesTemplate (sensitive: boolean, baseURL?: string, routeRules: Record<string, any> = { '/admin/**': { prerender: true }, '/protected/**': { redirect: '/login' } }) {
  const nuxt = await loadNuxt({
    cwd: pagesFixtureDir,
    ready: true,
    overrides: {
      router: { options: { sensitive } },
      ...baseURL ? { app: { baseURL } } : {},
      routeRules,
    },
  })
  try {
    return await routeRulesTemplate.getContents!({ nuxt, app: undefined!, options: routeRulesTemplate.options! })
  } finally {
    await nuxt.close()
  }
}

describe('route rules template', () => {
  it('matches with the build-time `sensitive` setting', async () => {
    const { defu } = await import('defu')
    for (const sensitive of [true, false]) {
      const contents = await getRouteRulesTemplate(sensitive)
      expect(contents).not.toContain('router.options.mjs')
      expect(contents.includes('foldRouteCase')).toBe(!sensitive)
      const matcher = new Function('defu', contents.replace(/^import \{ defu \} from .*$/m, '').replace('export default', 'return'))(defu) as (path: string) => Record<string, any>
      expect(matcher('/protected/secret')).toMatchObject({ redirect: '/login' })
      expect(matcher('/Protected/secret').redirect).toBe(sensitive ? undefined : '/login')
    }
  })

  it('emits a constant when only a catch-all rule applies', async () => {
    expect(await getRouteRulesTemplate(false, undefined, {})).toBe('export default () => ({ssr: true})')
    expect(await getRouteRulesTemplate(false, undefined, { '/**': { appLayout: 'a' }, 'GET /**': { appLayout: 'b' }, 'POST /admin/**': { ssr: false } }))
      .toBe('export default () => ({ssr: true,appLayout: "b"})')
  })

  it('leaves rules without client-side options out of the matcher', async () => {
    const contents = await getRouteRulesTemplate(true, undefined, { '/headers/**': { headers: { 'x-test': '1' } }, '/__nuxt_error': { cache: false } })
    expect(contents).toBe(await getRouteRulesTemplate(true, undefined, {}))
  })

  it('matches base-relative paths when app.baseURL is set', async () => {
    const contents = await getRouteRulesTemplate(false, '/sub/')
    const code = contents.replace(/^import \{ defu \} from .*$/m, '').replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/protected/secret')).toMatchObject({ redirect: '/login' })
    expect(matcher('/sub/protected/secret')).not.toHaveProperty('redirect')
  })

  it('accepts `appMiddleware` as a name or a list of names', async () => {
    const contents = await getRouteRulesTemplate(false, undefined, {
      '/string': { appMiddleware: 'auth' },
      '/array': { appMiddleware: ['auth', 'admin'] },
      '/object': { appMiddleware: { auth: false } },
    })
    const code = contents.replace(/^import \{ defu \} from .*$/m, '').replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/string').appMiddleware).toEqual({ auth: true })
    expect(matcher('/array').appMiddleware).toEqual({ auth: true, admin: true })
    expect(matcher('/object').appMiddleware).toEqual({ auth: false })
  })

  it('applies method-scoped rules that match a page request', async () => {
    const contents = await getRouteRulesTemplate(false, undefined, {
      '/admin/**': { appMiddleware: 'auth' },
      'GET /admin/**': { appMiddleware: 'admin', ssr: false },
      'get /lower/**': { ssr: false },
      'POST /admin/**': { ssr: true, appMiddleware: { auth: false } },
      'HEAD /admin/**': { noScripts: true },
    })
    const code = contents
      .replace(/^import \{ defu \} from .*$/m, '')
      .replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/admin/users')).toEqual({ appMiddleware: { auth: true, admin: true }, ssr: false })
    expect(matcher('/lower/page')).toEqual({ ssr: false })
  })

  it('applies `appMiddleware` to every path a case-insensitive page route matches', async () => {
    const routes = ['/σίγμα', '/окно', '/контакты']
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, undefined, Object.fromEntries(routes.map(route => [route, { appMiddleware: 'auth' }]))))
    const router = createRouter({ history: createMemoryHistory(), routes: routes.map(path => ({ path, component: {} })), sensitive: false })
    for (const path of ['/ςίγμα', '/ΣΊΓΜΑ', '/ᲂкно', '/ОКНО', '/кᲂнᲄакᲅы', '/КОНТАКТЫ']) {
      const to = router.resolve(path)
      expect(to.matched, path).toHaveLength(1)
      expect(matcher(to.path).appMiddleware, path).toEqual({ auth: true })
      expect(matcher(encodeURI(path)).appMiddleware, path).toEqual({ auth: true })
    }
  })

  it('applies `appMiddleware` from rules with regex constraints when case-insensitive', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, undefined, {
      '/y/:id(\\D+)': { appMiddleware: 'auth' },
      '/Z/:role(admin|[a-z]\\d)': { appMiddleware: 'admin' },
      '/Range/:id([A-z]+)': { appMiddleware: 'range' },
    }))
    expect(matcher('/y/abc').appMiddleware).toEqual({ auth: true })
    expect(matcher('/Y/ABC').appMiddleware).toEqual({ auth: true })
    expect(matcher('/y/123').appMiddleware).toBeUndefined()
    expect(matcher('/z/Admin').appMiddleware).toEqual({ admin: true })
    expect(matcher('/z/A1').appMiddleware).toEqual({ admin: true })
    expect(matcher('/z/AB').appMiddleware).toBeUndefined()
    expect(matcher('/range/ABC').appMiddleware).toEqual({ range: true })
    expect(matcher('/RANGE/_').appMiddleware).toEqual({ range: true })
    expect(matcher('/range/123').appMiddleware).toBeUndefined()
  })

  it('rejects regex constraints that depend on letter case when case-insensitive', async () => {
    await expect(getRouteRulesTemplate(false, undefined, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[A-Z]`)')
    await expect(getRouteRulesTemplate(false, undefined, { '/upper/:id([%41-%5A]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[A-Z]`)')
    await expect(getRouteRulesTemplate(false, undefined, { '/upper/:id([A-Z]+)': { headers: { 'x-test': '1' } } })).resolves.toBeTypeOf('string')
    await expect(getRouteRulesTemplate(false, undefined, { '/sigma/:id([a-zς]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[a-zς]`)')
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(true, undefined, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } }))
    expect(matcher('/upper/ABC').appMiddleware).toEqual({ auth: true })
    expect(matcher('/upper/abc').appMiddleware).toBeUndefined()
  })
})

async function evaluateMatcher (contents: string) {
  const { defu } = await import('defu')
  return new Function('defu', contents.replace(/^import \{ defu \} from .*$/m, '').replace('export default', 'return'))(defu) as (path: string) => Record<string, any>
}

describe('route rule redirects', () => {
  it('adds routes for redirects that apply to a page request', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        routeRules: {
          '/old/**': { redirect: '/new' },
          'GET /moved': { redirect: '/new' },
          '/kept': { redirect: '/new' },
          'GET /kept': { redirect: false },
          'POST /submit': { redirect: '/new' },
        },
      },
    })
    try {
      const pages: NuxtPage[] = []
      await nuxt.callHook('pages:extend', pages)
      expect(pages.map(page => page.path)).toEqual(['/old/:pathMatch(.*)', '/moved'])
    } finally {
      await nuxt.close()
    }
  })
})

describe('router options template', () => {
  async function getRouterOptionsTemplate (code: string) {
    const dir = await mkdtemp(join(tmpdir(), 'nuxt-router-options-'))
    const file = join(dir, 'router.options.ts')
    await writeFile(file, code)
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        router: { options: { sensitive: true } },
        hooks: { 'pages:routerOptions' ({ files }) { files.push({ path: file }) } },
      },
    })
    try {
      const template = nuxt.options.build.templates.find(t => t.filename === 'router.options.mjs')!
      return await template.getContents!({ nuxt, app: undefined!, options: template.options })
    } finally {
      await nuxt.close()
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('rejects router options files that set `sensitive`', async () => {
    await expect(getRouterOptionsTemplate('export default { sensitive: false }')).rejects.toThrow('sets `sensitive`')
  })

  it('uses `sensitive` from the config', async () => {
    const contents = await getRouterOptionsTemplate('const options = { sensitive: false }\nexport default options')
    expect(contents.trim().split('\n').slice(-2)).toEqual(['sensitive: true,', '}'])
  })
})
