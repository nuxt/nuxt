import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalize, resolve } from 'pathe'
import { writeTypes } from '@nuxt/kit'

import { loadNuxt } from '../src/index.ts'

const consumerDir = normalize(fileURLToPath(new URL('./sibling-layer-fixture/consumer', import.meta.url)))

/**
 * Regression test for #34763. When a consumer extends a layer whose source
 * lives outside the consumer's `rootDir` (a sibling layer, not a
 * `node_modules`-installed one), Volar walks up from a layer SFC to the
 * layer's own `tsconfig.json` and resolves the SFC under that project. The
 * layer's `nuxt prepare` always emits absolute `paths` for hoisted packages
 * like `vue`. If the consumer's `nuxt prepare` skips emitting them (the
 * default when the package appears in the consumer's `package.json`) the two
 * projects disagree on the identity of `vue`, and the layer SFC's default
 * export shows up as `any` in the editor (CLI builds via `vue-tsc --build`
 * remain unaffected, which is why this surfaces as IDE-only). We force the
 * consumer to emit the same absolute paths whenever an external sibling
 * layer is present.
 */
describe('external sibling layer typescript paths', () => {
  it('emits absolute `paths.vue` even when `vue` is in the consumer\'s package.json', async () => {
    const nuxt = await loadNuxt({ cwd: consumerDir, ready: true })
    try {
      await writeTypes(nuxt)
      const tsConfig = JSON.parse(await readFile(resolve(consumerDir, '.nuxt/tsconfig.app.json'), 'utf8'))
      const vuePath = tsConfig.compilerOptions?.paths?.vue
      expect(vuePath, 'consumer `tsconfig.app.json` should include a `paths.vue` mapping when an external sibling layer is present').toBeDefined()
      expect(vuePath?.[0]).toMatch(/node_modules.*vue/)
    } finally {
      await nuxt.close()
    }
  }, 60_000)
})
