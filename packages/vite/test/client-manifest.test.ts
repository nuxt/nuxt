import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { NuxtConfig } from 'nuxt/schema'
import type { Manifest } from 'vue-bundle-renderer'
import type { Plugin } from 'vite'

import { buildFixture, writeFiles } from './utils.ts'

const tmpDir = fileURLToPath(new URL('./.tmp/client-manifest', import.meta.url))

async function buildManifest (files: Record<string, string>, overrides: NuxtConfig) {
  await writeFiles(tmpDir, {
    'app/components/Lazy.vue': '<template><p class="lazy">lazy</p></template>\n\n<style scoped>.lazy { color: rebeccapurple }</style>',
    ...files,
  })
  let manifest: Manifest | undefined
  await buildFixture(tmpDir, { ssr: true, ...overrides }, (nuxt) => {
    nuxt.hook('build:manifest', (m) => { manifest = m })
  })
  return manifest!
}

function overrideClientManifest (manifest: string | boolean): Plugin {
  return {
    name: 'test:client-manifest-override',
    configEnvironment (name) {
      if (name === 'client') {
        return { build: { manifest } }
      }
    },
  }
}

describe('client manifest', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const lazyApp = {
    'app/app.vue': '<script setup>\nconst Lazy = defineAsyncComponent(() => import(\'./components/Lazy.vue\'))\n</script>\n\n<template><div><Lazy /></div></template>',
  }

  // https://github.com/nuxt/nuxt/issues/35868
  it.each([false, true])('resolves the client manifest when a plugin sets `build.manifest: true` (`nitroViteEnvironment: %s`)', async (nitroViteEnvironment) => {
    const manifest = await buildManifest(lazyApp, {
      pages: false,
      experimental: { nitroViteEnvironment },
      vite: { plugins: [overrideClientManifest(true)] },
    })

    const entries = Object.values(manifest)
    expect(entries.length).toBeGreaterThan(1)
    expect(entries.some(entry => entry.isEntry && entry.file?.endsWith('.js'))).toBe(true)
    expect(entries.some(entry => entry.src?.endsWith('components/Lazy.vue'))).toBe(true)
  }, 240 * 1000)

  it('fails with `NUXT_B7020` when a plugin disables the client manifest', async () => {
    await expect(buildManifest(lazyApp, {
      pages: false,
      vite: { plugins: [overrideClientManifest(false)] },
    })).rejects.toMatchObject({ code: 'NUXT_B7020' })
  }, 240 * 1000)

  it.each([
    ['default vite root', undefined],
    ['custom vite root', tmpDir],
  ] as const)('does not prefetch error page chunks from the entry (%s)', async (_, viteRoot) => {
    const manifest = await buildManifest({
      'app/app.vue': '<script setup>\nconst Lazy = defineAsyncComponent(() => import(\'./components/Lazy.vue\'))\n</script>\n\n<template><div><Lazy /><NuxtPage /></div></template>',
      'app/pages/index.vue': '<template><p>index</p></template>',
    }, viteRoot ? { vite: { root: viteRoot } } : {})

    const entry = Object.values(manifest).find(chunk => chunk.isEntry)
    expect(entry).toBeDefined()

    for (const name of ['error-404.vue', 'error-500.vue']) {
      const key = Object.keys(manifest).find(key => key.endsWith(name))
      expect(key, `${name} should have a chunk`).toBeDefined()
      expect(entry!.dynamicImports, `${name} should not be prefetched`).not.toContain(key)
    }

    const lazyKey = Object.keys(manifest).find(key => key.endsWith('components/Lazy.vue'))
    expect(lazyKey, 'lazy component should have a chunk').toBeDefined()
    expect(entry!.dynamicImports).toContain(lazyKey)
  }, 240 * 1000)
})
