import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt, writeTypes } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'

describe('writeTypes', () => {
  const relativeDir = join('../../..', 'test/fixtures/basic-types')
  const path = withoutTrailingSlash(normalize(fileURLToPath(new URL(relativeDir, import.meta.url))))

  let nuxt: Nuxt

  beforeAll(async () => {
    nuxt = await loadNuxt({ cwd: path })
    await Promise.all([
      rm(join(path, '.nuxt'), { recursive: true, force: true }),
    ])
  })

  afterAll(async () => {
    await nuxt.close()
  })

  bench('writeTypes in the basic-types fixture', async () => {
    await writeTypes(nuxt)
  })
})
