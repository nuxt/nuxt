import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { join, normalize } from 'pathe'
import { runWithNuxtContext } from '@nuxt/kit'
import { _generateTypes } from '../../kit/src/template.ts'
import { checkForExternalConfigurationFiles } from '../src/core/external-config-files.ts'
import { loadNuxt } from '../src/index.ts'

const cacheDir = normalize(fileURLToPath(new URL('../node_modules/.cache', import.meta.url)))

const fixtures: string[] = []

function createFixture (viteConfig: string) {
  mkdirSync(cacheDir, { recursive: true })
  const rootDir = mkdtempSync(join(cacheDir, 'external-config-'))
  fixtures.push(rootDir)
  writeFileSync(join(rootDir, 'nuxt.config.ts'), 'export default {}\n')
  writeFileSync(join(rootDir, 'vite.config.ts'), viteConfig)
  return rootDir
}

function loadFixture (rootDir: string) {
  return loadNuxt({ cwd: rootDir, overrides: { buildDir: join(rootDir, '.nuxt') }, ready: true })
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of fixtures.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const viteConfig = `import { defineConfig } from 'vite'\nexport default defineConfig({})\n`
const vitePlusConfig = `import { defineConfig } from 'vite-plus'\nexport default defineConfig({ lint: {} })\n`

describe('external configuration files', () => {
  it.for([
    ['a standalone vite config', viteConfig],
    ['a vite config with a commented-out vite-plus import', `// import { defineConfig } from 'vite-plus'\n${viteConfig}`],
  ])('warns about %s', async ([, config]) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nuxt = await loadFixture(createFixture(config!))

    await runWithNuxtContext(nuxt, checkForExternalConfigurationFiles)
    await nuxt.close()

    expect(warn.mock.calls.flat().join(' ')).toContain('NUXT_B5004')
  })

  it('does not warn about a Vite+ config', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nuxt = await loadFixture(createFixture(vitePlusConfig))

    await runWithNuxtContext(nuxt, checkForExternalConfigurationFiles)
    await nuxt.close()

    expect(warn.mock.calls.flat().join(' ')).not.toContain('NUXT_B5004')
  })

  it('includes a Vite+ config in the node tsconfig', async () => {
    const nuxt = await loadFixture(createFixture(vitePlusConfig))
    const { nodeTsConfig } = await _generateTypes(nuxt)
    await nuxt.close()

    expect(nodeTsConfig.include).toContain('../vite.config.ts')
  })

  it('does not include a standalone vite config in the node tsconfig', async () => {
    const nuxt = await loadFixture(createFixture(viteConfig))
    const { nodeTsConfig } = await _generateTypes(nuxt)
    await nuxt.close()

    expect(nodeTsConfig.include).not.toContain('../vite.config.ts')
  })
})
