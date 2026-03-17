import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveNodeModuleWorkerAssetPath } from '../src/plugins/dev-server'

const tempDirs: string[] = []

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('resolveNodeModuleWorkerAssetPath', () => {
  it('resolves worker assets from package dist/assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nuxt-dev-worker-'))
    tempDirs.push(root)

    const nodeModules = join(root, 'node_modules')
    const workerFile = join(nodeModules, 'magic', 'dist', 'assets', 'worker-abc.js')
    await mkdir(join(nodeModules, 'magic', 'dist', 'assets'), { recursive: true })
    await writeFile(workerFile, 'export default 1')

    const resolved = await resolveNodeModuleWorkerAssetPath('/assets/worker-abc.js', [nodeModules])
    expect(resolved).toBe(workerFile)
  })

  it('resolves worker assets from scoped packages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nuxt-dev-worker-'))
    tempDirs.push(root)

    const nodeModules = join(root, 'node_modules')
    const workerFile = join(nodeModules, '@scope', 'magic', 'dist', 'assets', 'worker-scope.js')
    await mkdir(join(nodeModules, '@scope', 'magic', 'dist', 'assets'), { recursive: true })
    await writeFile(workerFile, 'export default 2')

    const resolved = await resolveNodeModuleWorkerAssetPath('/assets/worker-scope.js', [nodeModules])
    expect(resolved).toBe(workerFile)
  })

  it('ignores non-worker asset requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nuxt-dev-worker-'))
    tempDirs.push(root)

    const nodeModules = join(root, 'node_modules')
    await mkdir(nodeModules, { recursive: true })

    const resolved = await resolveNodeModuleWorkerAssetPath('/assets/chunk-main.js', [nodeModules])
    expect(resolved).toBeNull()
  })
})
