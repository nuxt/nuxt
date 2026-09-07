import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'

const modulesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./modules-fixture', import.meta.url))))

describe('modules', () => {
  it('auto-registers modules in ~/modules and respects addServerHandler called from a nitro:config hook', async () => {
    const nuxt = await loadNuxt({ cwd: modulesFixtureDir, ready: true })

    const modules = nuxt.options._installedModules.map(item => item.meta.name ?? item.module.name)
    expect(modules).toContain('auto-registered-module')

    const handlerRoutes = (nuxt as any)._nitro.options.handlers.map((handler: { route?: string }) => handler.route)
    expect(handlerRoutes).toContain('/auto-registered-module')
    // #34982
    expect(handlerRoutes).toContain('/auto-registered-module-late')

    await nuxt.close()
  })
})
