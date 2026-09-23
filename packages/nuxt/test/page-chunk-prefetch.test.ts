import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import type { Manifest } from 'vue-bundle-renderer'

const tmpDir = fileURLToPath(new URL('./.tmp/page-chunk-prefetch', import.meta.url))
const appDir = join(tmpDir, 'app')
const layerDir = join(tmpDir, 'layer')

async function buildApp (extendsPath: string) {
  await rm(tmpDir, { recursive: true, force: true })

  await mkdir(join(layerDir, 'app/pages'), { recursive: true })
  await writeFile(join(layerDir, 'package.json'), JSON.stringify({ name: 'my-layer', type: 'module' }))
  await writeFile(join(layerDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})')
  await writeFile(join(layerDir, 'app/pages/layer-page.vue'), '<template><div>layer page</div></template>')

  await mkdir(join(appDir, 'app/pages'), { recursive: true })
  await mkdir(join(appDir, 'node_modules'), { recursive: true })
  // `junction` so this also works on Windows CI without elevated permissions
  await symlink(layerDir, join(appDir, 'node_modules/my-layer'), 'junction')
  await writeFile(join(appDir, 'app/pages/index.vue'), '<template><div>home</div></template>')

  const nuxt = await loadNuxt({
    cwd: appDir,
    ready: true,
    dev: false,
    overrides: {
      extends: [extendsPath],
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ssr: true,
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

function entryDynamicImports (manifest: Manifest) {
  return Object.values(manifest).find(chunk => chunk.isEntry)?.dynamicImports ?? []
}

// https://github.com/nuxt/nuxt/issues/36401
describe('page chunks are not prefetched from the entry', () => {
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('excludes page chunks of a layer extended by a path through a symlink', async () => {
    const manifest = await buildApp('./node_modules/my-layer')

    expect(manifest).toBeDefined()
    expect(Object.keys(manifest!).some(key => key.endsWith('layer-page.vue'))).toBe(true)
    expect(entryDynamicImports(manifest!).filter(i => i.endsWith('.vue') && i.includes('pages/'))).toEqual([])
  }, 240 * 1000)
})
