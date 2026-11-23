import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

async function getRouteRulesTemplate (sensitive: boolean, routeRules: Record<string, any> = { '/admin/**': { prerender: true } }, routerOptions?: string, nitroMajor?: 2 | 3) {
  const routerOptionsDir = routerOptions === undefined ? undefined : await mkdtemp(join(tmpdir(), 'nuxt-router-options-'))
  const routerOptionsFile = routerOptionsDir && join(routerOptionsDir, 'router.options.ts')
  if (routerOptionsFile) {
    await writeFile(routerOptionsFile, routerOptions!)
  }
  const nuxt = await loadNuxt({
    cwd: pagesFixtureDir,
    ready: true,
    overrides: {
      ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
      router: { options: { sensitive } },
      routeRules,
      hooks: routerOptionsFile ? { 'pages:routerOptions': ({ files }) => { files.push({ path: routerOptionsFile }) } } : {},
    },
  })
  try {
    return await routeRulesTemplate.getContents!({ nuxt, app: undefined!, options: routeRulesTemplate.options! })
  } finally {
    await nuxt.close()
    if (routerOptionsDir) {
      await rm(routerOptionsDir, { recursive: true, force: true })
    }
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

  it('emits a constant when only a catch-all rule applies', async () => {
    expect(await getRouteRulesTemplate(false, { '/**': { ssr: true, appLayout: 'a' } })).toBe('export const hasRedirects = false\nexport default () => ({ssr: true,appLayout: "a"})')
  })

  it('reports whether any rule redirects', async () => {
    expect(await getRouteRulesTemplate(false, { '/admin/**': { prerender: true } })).toContain('export const hasRedirects = false')
    expect(await getRouteRulesTemplate(false, { '/admin/**': { redirect: '/login' } })).toContain('export const hasRedirects = true')
    expect(await getRouteRulesTemplate(false, { '/**': { redirect: '/login' } })).toContain('export const hasRedirects = true')
  })

  it('leaves rules without client-side options out of the matcher', async () => {
    const contents = await getRouteRulesTemplate(true, { '/headers/**': { headers: { 'x-test': '1' } }, '/__nuxt_error': { cache: false } })
    expect(contents).toBe(await getRouteRulesTemplate(true, {}))
  })

  it('accepts `appMiddleware` as a name or a list of names', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/string': { appMiddleware: 'auth' },
      '/array': { appMiddleware: ['auth', 'admin'] },
      '/object': { appMiddleware: { auth: false } },
    })
    const matcher = await evaluateMatcher(contents)
    expect(matcher('/string').appMiddleware).toEqual({ auth: true })
    expect(matcher('/array').appMiddleware).toEqual({ auth: true, admin: true })
    expect(matcher('/object').appMiddleware).toEqual({ auth: false })
  })

  it('applies `appMiddleware` to every spelling vue-router matches case-insensitively', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/σίγμα': { appMiddleware: 'greek' },
      '/окно': { appMiddleware: 'cyrillic' },
    })
    const matcher = await evaluateMatcher(contents)
    for (const path of ['/σίγμα', '/ςίγμα', '/ΣΊΓΜΑ', `/${encodeURIComponent('ςίγμα')}`]) {
      expect(matcher(path).appMiddleware, path).toEqual({ greek: true })
    }
    for (const path of ['/окно', '/ᲂкно', '/ОКНО']) {
      expect(matcher(path).appMiddleware, path).toEqual({ cyrillic: true })
    }
  })

  it('applies `appMiddleware` from rules with regex constraints when case-insensitive', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/y/:id(\\D+)': { appMiddleware: 'auth' },
      '/Z/:role(admin|[a-z]\\d)': { appMiddleware: 'admin' },
      '/Range/:id([A-z]+)': { appMiddleware: 'range' },
    })
    const matcher = await evaluateMatcher(contents)
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
    await expect(getRouteRulesTemplate(false, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[A-Z]`)')
    await expect(getRouteRulesTemplate(false, { '/upper/:id([%41-%5A]+)': { appMiddleware: 'auth' } })).rejects.toThrow('depends on letter case (`[A-Z]`)')
    await expect(getRouteRulesTemplate(false, { '/upper/:id([A-Z]+)': { headers: { 'x-test': '1' } } })).resolves.toBeTypeOf('string')
    await expect(getRouteRulesTemplate(true, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })).resolves.toBeTypeOf('string')
  })

  it('throws at runtime when router options disable `sensitive` and a constraint depends on letter case', async () => {
    const caseDependent = await getRouteRulesTemplate(true, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } })
    await expect(evaluateMatcher(caseDependent, { sensitive: false })).rejects.toThrow('`/upper/:id([A-Z]+)` has a regex constraint that depends on letter case (`[A-Z]`)')
    expect((await evaluateMatcher(caseDependent, { sensitive: true }))('/upper/ABC').appMiddleware).toEqual({ auth: true })

    const caseIndependent = await getRouteRulesTemplate(true, { '/upper/:id([a-z]+)': { appMiddleware: 'auth' } })
    expect(caseIndependent).not.toContain('throw new Error')
    expect((await evaluateMatcher(caseIndependent, { sensitive: false }))('/Upper/ABC').appMiddleware).toEqual({ auth: true })
  })

  it('defers the check to runtime when a router options file may set `sensitive`', async () => {
    const contents = await getRouteRulesTemplate(false, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } }, 'export default { sensitive: true }')
    expect(contents).toContain('const sensitiveMatcher')
    expect(contents).toContain('routerOptions.sensitive')
    expect(contents).toContain('throw new Error')
    expect((await evaluateMatcher(contents, { sensitive: true }))('/upper/ABC').appMiddleware).toEqual({ auth: true })
    await expect(evaluateMatcher(contents, { sensitive: false })).rejects.toThrow('depends on letter case (`[A-Z]`)')

    await expect(getRouteRulesTemplate(false, { '/upper/:id([A-Z]+)': { appMiddleware: 'auth' } }, 'export default { scrollBehavior: () => ({ top: 0 }) }')).rejects.toThrow('depends on letter case (`[A-Z]`)')
  })
})

async function evaluateMatcher (contents: string, routerOptions: { sensitive?: boolean } = {}) {
  const code = contents.replace(/^import .*$/gm, '').replace(/^export const hasRedirects = .*$/m, '').replace('export default', 'return')
  const { defu } = await import('defu')
  return new Function('defu', 'routerOptions', code)(defu, routerOptions) as (path: string) => Record<string, any>
}

describe('wildcard route rule redirects', () => {
  it('moves the tail of the path onto the target', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(true, {
      '/old/**': { redirect: '/new/**' },
      '/old/kept': { redirect: '/kept' },
      '/old/sub/**': { redirect: { to: '/sub/**', status: 301 } },
      '/café/**': { redirect: '/new/**' },
      '/exact': { redirect: '/new/**' },
    }), { sensitive: true })
    expect(matcher('/old/A/b').redirect).toBe('/new/A/b')
    expect(matcher('/old').redirect).toBe('/new')
    expect(matcher('/%6Fld/A/b').redirect).toBe('/new/A/b')
    expect(matcher('/old/kept').redirect).toBe('/kept')
    expect(matcher('/old/sub/A/b').redirect).toBe('/sub/A/b')
    expect(matcher('/caf%C3%A9/A/b').redirect).toBe('/new/A/b')
    expect(matcher('/exact').redirect).toBe('/new/exact')
    for (const path of ['//old/A/b', '/old//A/b', '/%2Fold/A/b', '/old%2FA/b']) {
      expect(matcher(path).redirect, path).toBe('/new/A/b')
    }
    expect(matcher('/old%2F%2FA%2Fb').redirect).toBe('/new/A%2Fb')
    expect(matcher('//old/sub/A').redirect).toBe('/sub/A')
  })

  it('moves the tail of the path onto the target from a lone catch-all rule', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, { '/**': { redirect: '/new/**' } }))
    expect(matcher('/A/b').redirect).toBe('/new/A/b')
    expect(matcher('/').redirect).toBe('/new')
  })

  it('keeps the target on its origin when the tail starts with separators', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, { '/old/**': { redirect: '/**' } }))
    for (const tail of ['//evil.com', '///evil.com', '/\\evil.com', '/%2F%2Fevil.com', '/%5C%5Cevil.com', '/%252F%252Fevil.com']) {
      expect(matcher(`/old${tail}`).redirect, tail).toBe('/evil.com')
      expect(matcher(`/OLD${tail}`).redirect, tail).toBe('/evil.com')
    }
    const catchAll = await evaluateMatcher(await getRouteRulesTemplate(false, { '/**': { redirect: '/**' } }))
    expect(catchAll('//evil.com').redirect).toBe('/evil.com')
  })

  it('leaves a `**` that does not end the target as written', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, { '/query/**': { redirect: '/new?path=**' } }))
    expect(matcher('/query/a').redirect).toBe('/new?path=**')
  })

  it('keeps the casing of the tail when the base matches in another casing', async () => {
    for (const sensitive of [true, false]) {
      const matcher = await evaluateMatcher(await getRouteRulesTemplate(sensitive, { '/Old/**': { redirect: '/new/**' } }), { sensitive })
      expect(matcher('/Old/A/b').redirect).toBe('/new/A/b')
      expect(matcher('/OLD/A/b').redirect).toBe(sensitive ? undefined : '/new/A/b')
      expect(matcher('/old/A/b').redirect).toBe(sensitive ? undefined : '/new/A/b')
    }
  })
})

describe('route rules template on Nitro v3', () => {
  const patternRules = {
    '/star/*': { appMiddleware: 'star' },
    '/file/name.*': { appMiddleware: 'file' },
    '/before/*/end': { appMiddleware: 'before' },
    '/any/:id(.*)': { appMiddleware: 'any' },
    '/suffix/**/end': { appMiddleware: 'suffix' },
    '/user/:user-id': { appMiddleware: 'user' },
    '/named/:id': { appMiddleware: 'named' },
  }

  it('matches route rule patterns the way Nitro v3 does', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, patternRules, undefined, 3))
    expect(matcher('/star/a/b').appMiddleware).toEqual({ star: true })
    expect(matcher('/file/name.tar/gz').appMiddleware).toEqual({ file: true })
    expect(matcher('/before/a/b/end').appMiddleware).toEqual({ before: true })
    expect(matcher('/any/a/b').appMiddleware).toEqual({ any: true })
    expect(matcher('/suffix/a/end').appMiddleware).toEqual({ suffix: true })
    expect(matcher('/suffix/a/b').appMiddleware).toBeUndefined()
    expect(matcher('/user/a-id').appMiddleware).toEqual({ user: true })
    expect(matcher('/user/a').appMiddleware).toBeUndefined()
    expect(matcher('/named/a').appMiddleware).toEqual({ named: true })
    expect(matcher('/named/a/b').appMiddleware).toBeUndefined()
  })

  it('keeps matching route rule patterns the way nitropack does', async () => {
    for (const nitroMajor of [undefined, 2] as const) {
      const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, patternRules, undefined, nitroMajor))
      expect(matcher('/star/a').appMiddleware).toEqual({ star: true })
      expect(matcher('/star/a/b').appMiddleware).toBeUndefined()
      expect(matcher('/file/name.tar/gz').appMiddleware).toBeUndefined()
      expect(matcher('/before/a/b/end').appMiddleware).toBeUndefined()
      expect(matcher('/any/a/b').appMiddleware).toBeUndefined()
      expect(matcher('/suffix/a/b').appMiddleware).toEqual({ suffix: true })
      expect(matcher('/user/a').appMiddleware).toEqual({ user: true })
    }
  })

  it('folds the case of a lookup on Nitro v3 unless routing is `sensitive`', async () => {
    const folded = await evaluateMatcher(await getRouteRulesTemplate(false, { '/Admin/*': { appMiddleware: 'auth' } }, undefined, 3))
    expect(folded('/ADMIN/a/b').appMiddleware).toEqual({ auth: true })
    const sensitive = await evaluateMatcher(await getRouteRulesTemplate(true, { '/Admin/*': { appMiddleware: 'auth' } }, undefined, 3), { sensitive: true })
    expect(sensitive('/Admin/a/b').appMiddleware).toEqual({ auth: true })
    expect(sensitive('/admin/a/b').appMiddleware).toBeUndefined()
  })

  it('applies the rules for page requests from method-scoped keys on Nitro v3', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, {
      'GET /get/**': { appMiddleware: 'get' },
      'POST /post/**': { appMiddleware: 'post' },
      '/both/**': { appLayout: 'all', appMiddleware: 'all' },
      'GET /both/**': { appLayout: 'get' },
    }, undefined, 3))
    expect(matcher('/get/a').appMiddleware).toEqual({ get: true })
    expect(matcher('/post/a').appMiddleware).toBeUndefined()
    expect(matcher('/both/a')).toMatchObject({ appLayout: 'get', appMiddleware: { all: true } })
  })

  it('resolves wildcard redirect targets the way Nitro v3 does', async () => {
    const matcher = await evaluateMatcher(await getRouteRulesTemplate(false, {
      '/old/**': { redirect: '/new/**' },
      '/query/**': { redirect: '/new?path=**' },
      '/star/*': { redirect: '/new/**' },
      '/exact': { redirect: '/new?path=**' },
    }, undefined, 3))
    expect(matcher('/old/A/b').redirect).toBe('/new/A/b')
    expect(matcher('/query/a').redirect).toBe('/new?path=a')
    expect(matcher('/star/a/b').redirect).toBe('/new/star/a/b')
    expect(matcher('/exact').redirect).toBe('/new?path=**')
  })
})
