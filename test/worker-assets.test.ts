import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { join } from 'pathe'
import { projectSuffix, runsOnceInMatrix } from './matrix'

describe.skipIf(!runsOnceInMatrix)('assets shared between app and worker', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/worker-assets', import.meta.url))
  const outputDir = join(rootDir, `.output-${projectSuffix}`)

  beforeAll(async () => {
    const result = await exec('pnpm', ['nuxt', 'build', rootDir])
    if (result.exitCode !== 0) {
      throw new Error(`nuxt build failed:\n${result.stderr}\n${result.stdout}`)
    }
  }, 120 * 1000)

  // https://github.com/nuxt/nuxt/issues/22966
  it('emits a single copy of an asset imported from both app and worker', async () => {
    const assetsDir = join(outputDir, 'public', '_nuxt')
    const files = await readdir(assetsDir)
    const wasmFiles = files.filter(file => file.endsWith('.wasm'))
    expect(wasmFiles).toHaveLength(1)

    const chunks = await Promise.all(files.filter(file => file.endsWith('.js')).map(async file => [file, await readFile(join(assetsDir, file), 'utf-8')] as const))
    const referencedAssets = new Set(chunks.flatMap(([, code]) => code.match(/[\w.-]+\.wasm/g) ?? []))
    expect([...referencedAssets]).toEqual(wasmFiles)

    // the worker chunk and an app chunk must each point at the single emitted copy
    const referencingChunks = chunks.filter(([, code]) => code.includes(wasmFiles[0]!))
    expect(referencingChunks.some(([file]) => file.startsWith('worker-'))).toBe(true)
    expect(referencingChunks.some(([file]) => !file.startsWith('worker-'))).toBe(true)
  })
})
