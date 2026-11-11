import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { buildDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from 'nuxt/schema'

import { checkVueVersion } from '../src/core/vue-version.ts'
import pkg from '../package.json' with { type: 'json' }

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-version-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

it.each([
  [pkg.peerDependencies.vue.replace(/^\^/, ''), false],
  ['3.0.0', true],
])('checks vue@%s against the supported range', async (version, warns) => {
  const rootDir = join(tmpDir, version)
  await mkdir(join(rootDir, 'nuxt/dist/app'), { recursive: true })
  await mkdir(join(rootDir, 'nuxt/node_modules/vue'), { recursive: true })
  await writeFile(join(rootDir, 'nuxt/node_modules/vue/package.json'), JSON.stringify({ name: 'vue', version }))
  const report = vi.spyOn(buildDiagnostics, 'NUXT_B1023').mockImplementation(() => ({}) as any)

  await checkVueVersion({ options: { rootDir, appDir: join(rootDir, 'nuxt/dist/app') } } as unknown as Nuxt)

  expect(report.mock.calls).toMatchObject(warns ? [[{ version, range: pkg.peerDependencies.vue, installCommand: expect.stringContaining('vue') }]] : [])
  report.mockRestore()
})
