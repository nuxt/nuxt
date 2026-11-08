import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import type { NuxtConfig, NuxtManifest } from 'nuxt/schema'

const tmpDir = fileURLToPath(new URL('./.tmp/error-page-prefetch', import.meta.url))

async function build (overrides: NuxtConfig = {}) {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, 'app/pages'), { recursive: true })
  await mkdir(join(tmpDir, 'app/components'), { recursive: true })
  await writeFile(join(tmpDir, 'app/app.vue'), [
    '<script setup>',
    'const Lazy = defineAsyncComponent(() => import(\'./components/Lazy.vue\'))',
    '</script>',
    '',
    '<template><div><Lazy /><NuxtPage /></div></template>',
  ].join('\n'))
  await writeFile(join(tmpDir, 'app/components/Lazy.vue'), '<template><p>lazy</p></template>')
  await writeFile(join(tmpDir, 'app/pages/index.vue'), '<template><p>index</p></template>')

  const nuxt = await loadNuxt({
    cwd: tmpDir,
    ready: true,
    dev: false,
    overrides: {
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ssr: true,
      ...overrides,
    },
  })

  let manifest: NuxtManifest | undefined
  nuxt.hook('build:manifest', (m) => { manifest = m })

  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }

  return manifest!
}

describe('error page chunks', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const cases = [
    ['default vite root', undefined],
    ['custom vite root', tmpDir],
  ] as const

  describe.each(cases)('%s', (_, viteRoot) => {
    it('are not prefetched by the entry', async () => {
      const manifest = await build(viteRoot ? { vite: { root: viteRoot } } : {})

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
})
