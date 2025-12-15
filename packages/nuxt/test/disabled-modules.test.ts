import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import consola from 'consola'
import { loadNuxt } from '../src'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./disabled-modules-fixture', import.meta.url))))
const layerDir = join(fixtureDir, 'layers/base')

const consolaWarn = vi.spyOn(consola, 'warn')

beforeEach(() => {
  consolaWarn.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('disabledModules', () => {
  it('loads all modules when disabledModules is not set', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    expect(moduleNames).toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')
  })

  it('disables a single module from layer', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        disabledModules: [`${layerDir}/layer-module-a`],
      },
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    expect(moduleNames).not.toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')
  })

  it('disables multiple modules from layer', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        disabledModules: [`${layerDir}/layer-module-a`, `${layerDir}/layer-module-c`],
      },
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    expect(moduleNames).not.toContain('layer-module-a')
    expect(moduleNames).toContain('layer-module-b')
    expect(moduleNames).not.toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')
  })

  it('does not disable root project modules', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        disabledModules: [`${fixtureDir}/project-module`],
      },
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    // Project module should still be installed (root project modules are not disabled)
    expect(moduleNames).toContain('project-module')
    // Warn about the module not found in layers
    expect(consolaWarn).toHaveBeenCalledWith(
      expect.stringContaining('project-module'),
    )
  })

  it('warns when disabled module is not found in any layer', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        disabledModules: ['non-existent-module'],
      },
    })
    await nuxt.close()

    expect(consolaWarn).toHaveBeenCalledWith(
      expect.stringContaining('non-existent-module'),
    )
  })

  it('populates _layerModules with module names from layers', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
    })
    await nuxt.close()

    // Check that layer modules are in _layerModules (absolute paths)
    const layerModules = nuxt.options._layerModules
    expect(layerModules.some(m => m.includes('layer-module-a'))).toBe(true)
    expect(layerModules.some(m => m.includes('layer-module-b'))).toBe(true)
    expect(layerModules.some(m => m.includes('layer-module-c'))).toBe(true)
    // Project modules should not be in _layerModules
    expect(layerModules.some(m => m.includes('project-module'))).toBe(false)
  })

  it('disables all modules from layer when all are listed', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      overrides: {
        disabledModules: [
          `${layerDir}/layer-module-a`,
          `${layerDir}/layer-module-b`,
          `${layerDir}/layer-module-c`,
        ],
      },
    })
    await nuxt.close()

    const moduleNames = nuxt.options._installedModules
      .map(m => m.meta.name ?? m.module.name)
      .filter(name => name?.startsWith('layer-module') || name?.startsWith('project-module'))

    expect(moduleNames).not.toContain('layer-module-a')
    expect(moduleNames).not.toContain('layer-module-b')
    expect(moduleNames).not.toContain('layer-module-c')
    expect(moduleNames).toContain('project-module')
  })
})
