import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt } from '../src'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./disabled-modules-fixture', import.meta.url))))

describe('disable modules with false', () => {
  it('loads all modules when no module is disabled', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // All modules should be installed
    expect(moduleNames).toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')

    // All module setups should have run
    expect(nuxt.options.appConfig.layerModuleA).toBe(true)
    expect(nuxt.options.appConfig.layerModuleB).toBe(true)
    expect(nuxt.options.appConfig.layerModuleC).toBe(true)
  })

  it('disables a single module from layer', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        'layer-module-a': false,
      } as Record<string, unknown>,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // Module is still registered (for type generation)
    expect(moduleNames).toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')

    // But disabled module's setup was NOT executed
    expect(nuxt.options.appConfig.layerModuleA).toBeUndefined()
    // Other modules' setup should have run
    expect(nuxt.options.appConfig.layerModuleB).toBe(true)
    expect(nuxt.options.appConfig.layerModuleC).toBe(true)
  })

  it('disables multiple modules from layer', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        'layer-module-a': false,
        'layerModuleC': false,
      } as Record<string, unknown>,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // All modules are still registered (for type generation)
    expect(moduleNames).toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')

    // But disabled modules' setup was NOT executed
    expect(nuxt.options.appConfig.layerModuleA).toBeUndefined()
    expect(nuxt.options.appConfig.layerModuleC).toBeUndefined()
    // Other modules' setup should have run
    expect(nuxt.options.appConfig.layerModuleB).toBe(true)
  })

  it('disables project modules', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        'projectModule': false,
      } as Record<string, unknown>,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // Project module is still registered (for type generation)
    expect(moduleNames).toContain('project-module')
    // But disabled module's setup was NOT executed
    expect(nuxt.options.appConfig.projectModule).toBeUndefined()
  })

  it('disables all modules from layer when all are set to false', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        'layer-module-a': false,
        'layerModuleB': false,
        'layerModuleC': false,
      } as Record<string, unknown>,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // All modules are still registered (for type generation)
    expect(moduleNames).toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')

    // But all disabled modules' setup was NOT executed
    expect(nuxt.options.appConfig.layerModuleA).toBeUndefined()
    expect(nuxt.options.appConfig.layerModuleB).toBeUndefined()
    expect(nuxt.options.appConfig.layerModuleC).toBeUndefined()
  })
})
