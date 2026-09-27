import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

async function getRouteRulesTemplate (sensitive: boolean, baseURL?: string) {
  const nuxt = await loadNuxt({
    cwd: pagesFixtureDir,
    ready: true,
    overrides: {
      router: { options: { sensitive } },
      ...baseURL ? { app: { baseURL } } : {},
      routeRules: { '/admin/**': { prerender: true }, '/protected/**': { redirect: '/login' } },
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
})
