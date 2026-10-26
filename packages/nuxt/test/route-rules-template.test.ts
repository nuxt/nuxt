import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
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
      const matcher = new Function('defu', contents.replace(/^import \{ defu \} from .*$/m, '').replace('export default', 'return'))(defu) as (path: string) => Record<string, any>
      expect(matcher('/protected/secret')).toMatchObject({ redirect: '/login' })
      expect(matcher('/Protected/secret').redirect).toBe(sensitive ? undefined : '/login')
    }
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
