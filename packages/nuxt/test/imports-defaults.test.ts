import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNuxt } from '@nuxt/kit'
import type { Unimport } from 'unimport'
import { loadNuxt } from '../src/index.ts'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./imports-preset-fixture', import.meta.url))))

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('imports module defaults', () => {
  it('preserves non-JSON preset content when cloning defaults between invocations', async () => {
    let ctx: Unimport | undefined

    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      ready: true,
      overrides: {
        hooks: {
          'imports:context': (unimportCtx: Unimport) => {
            ctx = unimportCtx
          },
        },
        imports: {
          presets: [
            {
              package: 'defu',
              cache: false,
              ignore: [/^createDefu$/],
            },
          ],
        },
        builder: {
          bundle: () => {
            nuxt.hooks.removeAllHooks()
            return Promise.resolve()
          },
        },
      },
    })

    await buildNuxt(nuxt)
    await nuxt.close()

    // The imports module registers its own `modules:done` hook after all modules,
    // which calls `imports:context`. Assert the resolved imports respect the RegExp
    // `ignore` entry of the package preset.
    expect(ctx).toBeDefined()
    const imports = await ctx!.getImports()
    const names = imports.map(i => i.name)
    // `createDefu` is excluded by the RegExp `ignore` entry — the JSON clone in the
    // module corrupts RegExp values into `{}`, so this fails without the fix.
    expect(names).not.toContain('createDefu')
    // other exports of the package must still be present
    expect(names).toContain('defu')
  })
})
