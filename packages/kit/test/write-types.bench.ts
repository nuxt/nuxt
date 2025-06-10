import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { join, normalize, resolve } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import type { Nuxt } from 'nuxt/schema'
import { loadNuxt, writeTypes } from '@nuxt/kit'

describe('writeTypes', () => {
  const relativeDir = join('../../..', 'test/fixtures/basic-types')
  const path = withoutTrailingSlash(normalize(fileURLToPath(new URL(relativeDir, import.meta.url))))

  let nuxt: Nuxt

  beforeAll(async () => {
    nuxt = await loadNuxt({ cwd: path })
    await rm(resolve(path, '.nuxt'), { recursive: true, force: true })
  }, 20_000)

  afterAll(async () => {
    await nuxt.close()
  }, 20_000)

  bench('writeTypes in the basic-types fixture', async () => {
    await writeTypes(nuxt)
  })
})
