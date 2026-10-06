import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { loadNuxt } from '@nuxt/kit'
import type { Nitro, NitroConfig } from 'nitropack/types'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = {
  '__VUE_PROD_DEVTOOLS__': 'false',
  'import.meta.test': 'false',
}

async function withNitro<T> (fn: (nitro: Nitro, nitroConfig: NitroConfig) => T | Promise<T>) {
  let nitroConfig: NitroConfig | undefined
  let nitro: Nitro | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      hooks: {
        'nitro:config' (config) {
          nitroConfig = config
        },
        'nitro:init' (_nitro) {
          nitro = _nitro
        },
      },
    },
  })
  try {
    return await fn(nitro!, nitroConfig!)
  } finally {
    await nuxt.close()
  }
}

describe('nitro config', () => {
  it('passes the server replacements to nitro as `replace`', async () => {
    await withNitro((_nitro, nitroConfig) => {
      expect(nitroConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('passes the server replacements to the prerenderer', async () => {
    await withNitro(async (nitro) => {
      // nitro creates the prerenderer from a copy of this config
      const prerendererConfig: NitroConfig = { ...nitro.options._config }
      await nitro.hooks.callHook('prerender:config', prerendererConfig)
      expect(prerendererConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('inlines the nuxt renderer with either path separator', async () => {
    await withNitro(async (nitro) => {
      const isInlined = async (id: string) => {
        for (const matcher of nitro.options.externals.inline!) {
          if (typeof matcher === 'function' ? await matcher(id) : matcher instanceof RegExp ? matcher.test(id) : id.startsWith(matcher) || id.split('node_modules/').pop()!.startsWith(matcher)) {
            return true
          }
        }
        return false
      }
      expect(await isInlined('/project/node_modules/nuxt/dist/runtime/server/renderer/index.js')).toBe(true)
      expect(await isInlined('D:\\project\\node_modules\\nuxt\\dist\\runtime\\server\\renderer\\index.js')).toBe(true)
    })
  })

  it('does not include the dev error channel in production builds', async () => {
    await withNitro((_nitro, nitroConfig) => {
      const errorChannel = nitroConfig.virtual!['#internal/nuxt/error-channel'] as () => string
      expect(errorChannel()).toBe('export {}')
    })
  })
})
