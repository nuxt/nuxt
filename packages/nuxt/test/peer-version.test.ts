import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { buildDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from 'nuxt/schema'

import { checkPeerVersion } from '../src/core/peer-version.ts'
import pkg from '../package.json' with { type: 'json' }

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-peer-version-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

it.each([
  ['vue', pkg.peerDependencies.vue.replace(/^\^/, ''), false],
  ['vue', '3.0.0', true],
  ['vue-router', pkg.peerDependencies['vue-router'].replace(/^\^/, ''), false],
  ['vue-router', '4.6.4', true],
] as const)('checks %s@%s against the supported range', async (name, version, warns) => {
  const rootDir = join(tmpDir, name, version)
  await mkdir(join(rootDir, 'nuxt/dist/app'), { recursive: true })
  await mkdir(join(rootDir, 'nuxt/node_modules', name), { recursive: true })
  await writeFile(join(rootDir, 'nuxt/node_modules', name, 'package.json'), JSON.stringify({ name, version }))
  const report = vi.spyOn(buildDiagnostics, 'NUXT_B1023').mockImplementation(() => ({}) as any)

  await checkPeerVersion({ options: { rootDir, appDir: join(rootDir, 'nuxt/dist/app') } } as unknown as Nuxt, name)

  expect(report.mock.calls).toMatchObject(warns ? [[{ name, version, range: pkg.peerDependencies[name], installCommand: expect.stringContaining(name) }]] : [])
  report.mockRestore()
})
