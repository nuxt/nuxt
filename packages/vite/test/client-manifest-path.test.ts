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

// https://github.com/nuxt/nuxt/issues/36343
describe('components bundled into chunks without a facade module', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('gains manifest entries with their stylesheets (`inlineStyles: false`)', async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'app/components'), { recursive: true })
    await mkdir(join(tmpDir, 'app/pages'), { recursive: true })
    await writeFile(join(tmpDir, 'app/app.vue'), '<template><NuxtPage /></template>')
    await writeFile(join(tmpDir, 'app/components/Lazy.vue'), [
      '<template><p class="lazy">lazy</p></template>',
      '',
      '<style scoped>.lazy { color: rebeccapurple }</style>',
    ].join('\n'))
    // The component is lazily loaded on one page and statically imported on another,
    // so the bundler merges it into a chunk without a facade module.
    await writeFile(join(tmpDir, 'app/pages/index.vue'), [
      '<script setup>',
      'const Lazy = defineAsyncComponent(() => import(\'../components/Lazy.vue\'))',
      '</script>',
      '',
      '<template><div><Lazy /></div></template>',
    ].join('\n'))
    await writeFile(join(tmpDir, 'app/pages/other.vue'), [
      '<script setup>',
      'import Lazy from \'../components/Lazy.vue\'',
      '</script>',
      '',
      '<template><div><Lazy /></div></template>',
    ].join('\n'))

    const nuxt = await loadNuxt({
      cwd: tmpDir,
      ready: true,
      dev: false,
      overrides: {
        compatibilityDate: 'latest',
        devtools: { enabled: false },
        ssr: true,
        features: { inlineStyles: false },
        vite: {
          build: {
            rollupOptions: {
              output: {
                // Force the component into a manual chunk, which — unlike dynamic
                // entry chunks — has no facade module carrying its manifest key.
                manualChunks: (id: string) => id.endsWith('components/Lazy.vue') ? 'shared-lazy' : undefined,
              },
            },
          },
        },
      },
    })

    let manifest: Manifest | undefined
    nuxt.hook('build:manifest', (m) => { manifest = m })

    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }

    const entry = manifest!['components/Lazy.vue']
    expect(entry).toBeDefined()
    expect(entry!.css?.length).toBeGreaterThan(0)
  }, 240 * 1000)

  it('does not add alias entries when styles are inlined (default `inlineStyles`)', async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(join(tmpDir, 'app/components'), { recursive: true })
    await mkdir(join(tmpDir, 'app/pages'), { recursive: true })
    await writeFile(join(tmpDir, 'app/app.vue'), '<template><NuxtPage /></template>')
    await writeFile(join(tmpDir, 'app/components/Lazy.vue'), [
      '<template><p class="lazy">lazy</p></template>',
      '',
      '<style scoped>.lazy { color: rebeccapurple }</style>',
    ].join('\n'))
    await writeFile(join(tmpDir, 'app/pages/index.vue'), [
      '<script setup>',
      'const Lazy = defineAsyncComponent(() => import(\'../components/Lazy.vue\'))',
      '</script>',
      '',
      '<template><div><Lazy /></div></template>',
    ].join('\n'))
    await writeFile(join(tmpDir, 'app/pages/other.vue'), [
      '<script setup>',
      'import Lazy from \'../components/Lazy.vue\'',
      '</script>',
      '',
      '<template><div><Lazy /></div></template>',
    ].join('\n'))

    const nuxt = await loadNuxt({
      cwd: tmpDir,
      ready: true,
      dev: false,
      overrides: {
        compatibilityDate: 'latest',
        devtools: { enabled: false },
        ssr: true,
        vite: {
          build: {
            rollupOptions: {
              output: {
                manualChunks: (id: string) => id.endsWith('components/Lazy.vue') ? 'shared-lazy' : undefined,
              },
            },
          },
        },
      },
    })

    let manifest: Manifest | undefined
    nuxt.hook('build:manifest', (m) => { manifest = m })

    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }

    // With styles inlined by default the renderer never looks up a stylesheet
    // link for the component, so no manifest alias is added.
    expect(manifest!['components/Lazy.vue']).toBeUndefined()
  }, 240 * 1000)
})
