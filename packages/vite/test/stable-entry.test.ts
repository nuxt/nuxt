import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { join } from 'pathe'

const tmpDir = fileURLToPath(new URL('./.tmp/stable-entry', import.meta.url))

async function writeApp (extraPages: number) {
  await mkdir(join(tmpDir, 'app/components'), { recursive: true })
  await mkdir(join(tmpDir, 'app/pages'), { recursive: true })
  await writeFile(join(tmpDir, 'app/app.vue'), '<template><div><NuxtPage /></div></template>')
  await writeFile(join(tmpDir, 'app/pages/index.vue'), [
    '<script setup>',
    'const Lazy = defineAsyncComponent(() => import(\'../components/Lazy.vue\'))',
    '</script>',
    '',
    '<template><div><Lazy /></div></template>',
  ].join('\n'))
  // a lazy component which itself lazily loads a component that pulls in the entry,
  // so the chunk for `Lazy.vue` carries a preload dependency list mentioning the entry
  await writeFile(join(tmpDir, 'app/components/Lazy.vue'), [
    '<script setup>',
    'const Nested = defineAsyncComponent(() => import(\'./Nested.vue\'))',
    '</script>',
    '',
    '<template><div><Nested /></div></template>',
  ].join('\n'))
  await writeFile(join(tmpDir, 'app/components/Nested.vue'), [
    '<script setup>',
    'const count = useState(\'count\', () => 0)',
    '</script>',
    '',
    '<template><p>{{ count }}</p></template>',
  ].join('\n'))
  for (let i = 0; i < extraPages; i++) {
    await writeFile(join(tmpDir, `app/pages/extra-${i}.vue`), `<template><p>extra ${i}</p></template>`)
  }
}

async function build () {
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

  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }

  const dir = join(tmpDir, '.output/public', nuxt.options.app.buildAssetsDir.replace(/^\/+/, ''))
  const chunks: Record<string, string> = {}
  let importsEntrySpecifier = false
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.js')) { continue }
    const contents = await readFile(join(dir, file), 'utf8')
    importsEntrySpecifier ||= contents.includes('"#entry"')
    chunks[file] = createHash('sha256').update(contents).digest('hex')
  }
  return { chunks, importsEntrySpecifier }
}

// https://github.com/nuxt/nuxt/issues/36136
describe('stable entry', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('emits identical content for chunks whose hashed filename is unchanged', async () => {
    await rm(tmpDir, { recursive: true, force: true })

    await writeApp(0)
    const before = await build()

    await writeApp(1)
    const after = await build()

    // guard against the assertion below passing vacuously if the entry is no
    // longer rewritten to a bare specifier
    expect(before.importsEntrySpecifier).toBe(true)

    const shared = Object.keys(before.chunks).filter(file => file in after.chunks)
    expect(shared.length).toBeGreaterThan(0)

    const collisions = shared.filter(file => before.chunks[file] !== after.chunks[file])
    expect(collisions).toEqual([])
  }, 240 * 1000)
})
