import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, normalize } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addComponentsDir } from '@nuxt/kit'
import { build, loadNuxt } from 'nuxt'

describe('components dir watching', { sequential: true }, async () => {
  const tmpDir = join(await findWorkspaceDir(), '.test/components-watch-dirs')

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'project/node_modules'), { recursive: true })
    await mkdir(join(tmpDir, 'project/app'), { recursive: true })
    await writeFile(join(tmpDir, 'project/nuxt.config.ts'), 'export default {}\n')
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // https://github.com/nuxt/nuxt/issues/12350
  it('adds external module component dirs to nuxt.options.watch in dev', async () => {
    const rootDir = join(tmpDir, 'project')
    const moduleComponentsDir = join(tmpDir, 'external-module/runtime/components')
    await mkdir(moduleComponentsDir, { recursive: true })

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        modules: [
          () => {
            addComponentsDir({
              path: moduleComponentsDir,
              pathPrefix: false,
            })
          },
        ],
        builder: {
          bundle: () => {
            nuxt.hooks.removeAllHooks()
            return Promise.resolve()
          },
        },
      },
    })

    await build(nuxt)

    expect(nuxt.options.watch.map(p => typeof p === 'string' ? normalize(p) : p))
      .toContain(normalize(moduleComponentsDir))

    await nuxt.close()
  })

  it('does not watch dirs when watch is false or already covered by a layer', async () => {
    const rootDir = join(tmpDir, 'project')
    await mkdir(join(rootDir, 'app/components'), { recursive: true })

    const externalDir = join(tmpDir, 'external/components')
    await mkdir(externalDir, { recursive: true })

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        modules: [
          () => {
            addComponentsDir({
              path: externalDir,
              watch: false,
            })
          },
        ],
        builder: {
          bundle: () => {
            nuxt.hooks.removeAllHooks()
            return Promise.resolve()
          },
        },
      },
    })

    await build(nuxt)

    const watched = nuxt.options.watch
      .filter((p): p is string => typeof p === 'string')
      .map(p => normalize(p))

    expect(watched).not.toContain(normalize(externalDir))
    expect(watched.some(p => /[/\\]app[/\\]components$/.test(p))).toBe(false)

    await nuxt.close()
  })

  it('does not watch component dirs inside node_modules', async () => {
    const rootDir = join(tmpDir, 'project')
    const nodeModulesDir = join(rootDir, 'node_modules/external-module/components')
    await mkdir(nodeModulesDir, { recursive: true })

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        dev: true,
        modules: [
          () => {
            addComponentsDir({
              path: nodeModulesDir,
              watch: true,
            })
          },
        ],
        builder: {
          bundle: () => {
            nuxt.hooks.removeAllHooks()
            return Promise.resolve()
          },
        },
      },
    })

    await build(nuxt)

    expect(nuxt.options.watch.map(p => typeof p === 'string' ? normalize(p) : p))
      .not.toContain(normalize(nodeModulesDir))

    await nuxt.close()
  })
})
