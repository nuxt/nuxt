import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt } from '../src'

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

describe('loadNuxt', () => {
  it('respects hook overrides', async () => {
    let hookRan = false
    const nuxt = await loadNuxt({
      cwd: repoRoot,
      ready: true,
      overrides: {
        hooks: {
          ready () {
            hookRan = true
          },
        },
      },
    })
    await nuxt.close()
    expect(hookRan).toBe(true)
  })
})
