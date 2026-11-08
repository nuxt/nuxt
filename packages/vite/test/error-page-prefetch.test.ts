import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import type { NuxtManifest } from 'nuxt/schema'

const tmpDir = fileURLToPath(new URL('./.tmp/error-page-prefetch', import.meta.url))

async function build () {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, 'app/pages'), { recursive: true })
  await writeFile(join(tmpDir, 'app/app.vue'), '<template><NuxtPage /></template>')
  await writeFile(join(tmpDir, 'app/pages/index.vue'), '<template><p>index</p></template>')

  const nuxt = await loadNuxt({
    cwd: tmpDir,
    ready: true,
    dev: false,
    overrides: {
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ssr: true,
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

  it('are not prefetched by the entry', async () => {
    const manifest = await build()

    const entry = Object.values(manifest).find(chunk => chunk.isEntry)
    expect(entry).toBeDefined()

    const errorPages = ['error-404.vue', 'error-500.vue'].map(name => ({
      name,
      key: Object.keys(manifest).find(key => key.endsWith(name)),
    }))

    for (const { name, key } of errorPages) {
      expect(key, `${name} should have a chunk`).toBeDefined()
      expect(entry!.dynamicImports, `${name} should not be prefetched`).not.toContain(key)
    }
  }, 240 * 1000)
})
