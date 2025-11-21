import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src'
import { buildNuxt } from '@nuxt/kit'
import type { ComponentsDir } from 'nuxt/schema'

const layerFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./layers-fixture', import.meta.url))))

describe('components layer priority', () => {
  it('assigns priorities to component dirs based on layer order', async () => {
    const captured: ComponentsDir[] = []

    const nuxt = await loadNuxt({
      cwd: layerFixtureDir,
      ready: true,
      overrides: {
        builder: {
          bundle: () => {
            nuxt.hooks.removeAllHooks()
            return Promise.resolve()
          },
        },
      },
    })

    nuxt.hook('components:dirs', (dirs) => {
      captured.push(...dirs as any[])
    })

    await buildNuxt(nuxt)

    const dirs = captured.map(dir => [
      dir.path.replace(layerFixtureDir, '<root>'),
      dir.priority,
    ])

    expect(Object.fromEntries(dirs)).toStrictEqual({
      // user project: highest priority
      '<root>/components': 3,
      '<root>/components/global': 3,
      '<root>/components/islands': 3,
      // local layer
      '<root>/layers/auto/components': 2,
      '<root>/layers/auto/components/global': 2,
      '<root>/layers/auto/components/islands': 2,
      // explicitly extended layer
      '<root>/custom/components': 1,
      '<root>/custom/components/global': 1,
      '<root>/custom/components/islands': 1,
    })

    await nuxt.close()
  })
})
