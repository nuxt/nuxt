import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

async function getRouteRulesTemplate (sensitive: boolean, routeRules: Record<string, any> = { '/admin/**': { prerender: true } }) {
  const nuxt = await loadNuxt({
    cwd: pagesFixtureDir,
    ready: true,
    overrides: {
      router: { options: { sensitive } },
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

  it('applies `appMiddleware` on a case-sensitive regex constraint when case-insensitive', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/y/:id(\\D+)': { appMiddleware: 'auth' },
      '/z/:role(Admin|[A-Z]\\d)': { appMiddleware: 'admin' },
    })
    const matcher = await evaluateMatcher(contents)
    expect(matcher('/y/abc').appMiddleware).toEqual({ auth: true })
    expect(matcher('/Y/ABC').appMiddleware).toEqual({ auth: true })
    expect(matcher('/y/123').appMiddleware).toBeUndefined()
    expect(matcher('/z/Admin').appMiddleware).toEqual({ admin: true })
    expect(matcher('/z/A1').appMiddleware).toEqual({ admin: true })
    expect(matcher('/z/AB').appMiddleware).toBeUndefined()
  })

  it('applies `appMiddleware` on a regex constraint whose meaning changes when lower-cased', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/protected/:slug([A-z]+)': { appMiddleware: 'auth' },
    })
    const matcher = await evaluateMatcher(contents)
    expect(matcher('/protected/_').appMiddleware).toEqual({ auth: true })
    expect(matcher('/Protected/abc').appMiddleware).toEqual({ auth: true })
    expect(matcher('/protected/123').appMiddleware).toBeUndefined()
  })

  it('keeps rules matched case-insensitively when the original-case lookup matches more', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/Admin/**': { appMiddleware: 'auth' },
      '/admin/:x([A-z])': { ssr: false },
      '/admin/:y([A-z]+)': { prerender: true },
    })
    const matcher = await evaluateMatcher(contents)
    expect(matcher('/admin/_')).toEqual({ appMiddleware: { auth: true }, ssr: false, prerender: true })
  })

  it('matches by original case when a case-insensitive lookup compiles to a single matcher', async () => {
    const contents = await getRouteRulesTemplate(false, {
      '/x/:id(\\x41+)': { appMiddleware: 'auth' },
    })
    expect(contents).not.toContain('router.options.mjs')
    expect(contents).toContain('const foldedMatcher = sensitiveMatcher')
    const matcher = await evaluateMatcher(contents)
    expect(matcher('/x/AA').appMiddleware).toEqual({ auth: true })
  })
})

async function evaluateMatcher (contents: string) {
  const code = contents.replace(/^import .*$/gm, '').replace('export default', 'return')
  const { defu } = await import('defu')
  return new Function('defu', 'routerOptions', code)(defu, {}) as (path: string) => Record<string, any>
}
