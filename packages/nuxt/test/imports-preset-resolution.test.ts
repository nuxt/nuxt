import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNuxt } from '@nuxt/kit'
import { loadNuxt } from '../src/index.ts'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./imports-preset-fixture', import.meta.url))))

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('imports preset resolution', () => {
  it('warns when a preset `from` cannot be resolved', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
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

    await buildNuxt(nuxt)
    await nuxt.close()

    const messages = warn.mock.calls.map(call => call.join(' '))
    expect(messages.some(message => message.includes('NUXT_B6005') && message.includes('nuxt/dist/composables/router'))).toBe(true)
  })
})
