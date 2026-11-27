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

  const fixtureModules = { layerModuleA: 'layer-module-a', layerModuleB: 'layer-module-b', layerModuleC: 'layer-module-c', projectModule: 'project-module' }

  it.each<[Record<string, unknown>, string[]]>([
    [{}, []],
    [{ 'layer-module-a': false }, ['layerModuleA']],
    [{ 'layer-module-a': false, 'layerModuleC': false }, ['layerModuleA', 'layerModuleC']],
    [{ projectModule: false }, ['projectModule']],
    [{ 'layer-module-a': false, 'layerModuleB': false, 'layerModuleC': false }, ['layerModuleA', 'layerModuleB', 'layerModuleC']],
  ])('registers but does not set up modules disabled with %o', async (overrides, disabled) => {
    const nuxt = await loadNuxt({ cwd: modulesFixtureDir, overrides })
    await nuxt.close()

    // disabled modules are still registered, for type generation
    const moduleNames = nuxt.options._installedModules.map(m => m.meta.name ?? m.module.name)
    expect(moduleNames).toEqual(expect.arrayContaining(Object.values(fixtureModules)))

    for (const key of Object.keys(fixtureModules)) {
      expect(nuxt.options.appConfig[key], key).toBe(disabled.includes(key) ? undefined : true)
    }
  })
})
