import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

async function getRouteRulesTemplate (sensitive: boolean, routeRules: Record<string, any> = { '/admin/**': { prerender: true } }, routerOptions?: string) {
  const routerOptionsDir = routerOptions === undefined ? undefined : await mkdtemp(join(tmpdir(), 'nuxt-router-options-'))
  const routerOptionsFile = routerOptionsDir && join(routerOptionsDir, 'router.options.ts')
  if (routerOptionsFile) {
    await writeFile(routerOptionsFile, routerOptions!)
  }
  const nuxt = await loadNuxt({
    cwd: pagesFixtureDir,
    ready: true,
    overrides: {
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
  const code = contents.replace(/^import .*$/gm, '').replace('export default', 'return')
  const { defu } = await import('defu')
  return new Function('defu', 'routerOptions', code)(defu, routerOptions) as (path: string) => Record<string, any>
}
