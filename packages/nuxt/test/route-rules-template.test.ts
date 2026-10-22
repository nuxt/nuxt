import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
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
  it('does not import router options when case-insensitive matching is unconditional', async () => {
    const contents = await getRouteRulesTemplate(false)
    expect(contents).not.toContain('router.options.mjs')
    expect(contents).toContain('normalizePath(path, true)')
  })

  it('picks the matcher at runtime when route rules are case sensitive', async () => {
    const contents = await getRouteRulesTemplate(true)
    expect(contents).toContain('router.options.mjs')
    expect(contents).toContain('routerOptions.sensitive')
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
      .replace(/^import routerOptions from .*$/m, 'const routerOptions = {}')
      .replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/admin/users')).toEqual({ appMiddleware: { auth: true, admin: true }, ssr: false })
    expect(matcher('/lower/page')).toEqual({ ssr: false })
  })

  it('applies `appMiddleware` from rules with regex constraints', async () => {
    const contents = await getRouteRulesTemplate(false, undefined, {
      '/blog/:slug(caf%C3%A9)': { appMiddleware: 'auth' },
      '/unencoded/:slug(café)': { appMiddleware: 'auth' },
      '/x/:id(\\D+)': { appMiddleware: 'admin' },
      '/Range/:id([A-z]+)': { appMiddleware: 'auth' },
    })
    const code = contents
      .replace(/^import \{ defu \} from .*$/m, '')
      .replace(/^import routerOptions from .*$/m, 'const routerOptions = {}')
      .replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/blog/café').appMiddleware).toEqual({ auth: true })
    expect(matcher('/Blog/caf%C3%A9').appMiddleware).toEqual({ auth: true })
    expect(matcher('/unencoded/café').appMiddleware).toEqual({ auth: true })
    expect(matcher('/x/abc').appMiddleware).toEqual({ admin: true })
    expect(matcher('/x/123')).not.toHaveProperty('appMiddleware')
    expect(matcher('/range/ABC').appMiddleware).toEqual({ auth: true })
    expect(matcher('/RANGE/_').appMiddleware).toEqual({ auth: true })
  })

  it('rejects regex constraints that depend on letter case', async () => {
    await expect(getRouteRulesTemplate(false, undefined, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[A-Z]`)')
    await expect(getRouteRulesTemplate(true, undefined, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })).resolves.toBeTypeOf('string')
  })

  it('applies `appMiddleware` from rules with unencoded regex constraints read from the config', async () => {
    const nuxt = {
      options: {
        app: { baseURL: '/' },
        router: { options: {} },
        routeRules: { '/blog/:slug(café)': { appMiddleware: 'auth' } },
      },
    } as unknown as Nuxt
    const contents = await routeRulesTemplate.getContents!({ nuxt, app: undefined!, options: routeRulesTemplate.options! })
    const code = contents
      .replace(/^import \{ defu \} from .*$/m, '')
      .replace(/^import routerOptions from .*$/m, 'const routerOptions = {}')
      .replace('export default', 'return')
    const { defu } = await import('defu')
    const matcher = new Function('defu', code)(defu) as (path: string) => Record<string, any>
    expect(matcher('/blog/café').appMiddleware).toEqual({ auth: true })
    expect(matcher('/blog/caf%C3%A9').appMiddleware).toEqual({ auth: true })
  })
})

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
