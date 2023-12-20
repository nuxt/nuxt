import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt, writeTypes } from '../src'

describe('writeTypes', async () => {
  const relativeDir = join('../../..', 'test/fixtures/basic-types')
  const path = withoutTrailingSlash(normalize(fileURLToPath(new URL(relativeDir, import.meta.url))))

  let nuxt: Nuxt

  bench('write types', async () => { await writeTypes(nuxt) }, {
    async setup () { nuxt = await loadNuxt({ cwd: path }) },
    async teardown() { await nuxt.close() }
  })
})
