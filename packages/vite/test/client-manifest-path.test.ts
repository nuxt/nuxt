import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import type { NuxtConfig } from 'nuxt/schema'
import type { Manifest } from 'vue-bundle-renderer'
import type { Plugin } from 'vite'

const tmpDir = fileURLToPath(new URL('./.tmp/client-manifest-path', import.meta.url))

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

async function buildApp (overrides: NuxtConfig) {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, 'app/components'), { recursive: true })
  await writeFile(join(tmpDir, 'app/app.vue'), [
    '<script setup>',
    'const Lazy = defineAsyncComponent(() => import(\'./components/Lazy.vue\'))',
    '</script>',
    '',
    '<template><div><Lazy /></div></template>',
  ].join('\n'))
  await writeFile(join(tmpDir, 'app/components/Lazy.vue'), [
    '<template><p class="lazy">lazy</p></template>',
    '',
    '<style scoped>.lazy { color: rebeccapurple }</style>',
  ].join('\n'))

  const nuxt = await loadNuxt({
    cwd: tmpDir,
    ready: true,
    dev: false,
    overrides: {
      ...overrides,
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ssr: true,
      pages: false,
    },
  })

  let manifest: Manifest | undefined
  nuxt.hook('build:manifest', (m) => { manifest = m })

  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }

  return manifest
}

// https://github.com/nuxt/nuxt/issues/35868
describe('client manifest path overridden by a vite plugin', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it.each([false, true])('resolves the client manifest when a plugin sets `build.manifest: true` (`nitroViteEnvironment: %s`)', async (nitroViteEnvironment) => {
    const manifest = await buildApp({
      experimental: { nitroViteEnvironment },
      vite: { plugins: [overrideClientManifest(true)] },
    })

    const entries = Object.values(manifest!)
    expect(entries.length).toBeGreaterThan(1)
    expect(entries.some(entry => entry.isEntry && entry.file?.endsWith('.js'))).toBe(true)
    expect(entries.some(entry => entry.src?.endsWith('components/Lazy.vue'))).toBe(true)
  }, 240 * 1000)

  it('fails with `NUXT_B7020` when a plugin disables the client manifest', async () => {
    await expect(buildApp({
      vite: { plugins: [overrideClientManifest(false)] },
    })).rejects.toMatchObject({ code: 'NUXT_B7020' })
  }, 240 * 1000)
})
