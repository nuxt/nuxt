import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import { dirname, join } from 'pathe'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from 'nuxt/schema'

import { checkVueVersion } from '../src/core/vue-version.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-version-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

async function write (path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function writeVue (dir: string, version: string) {
  await write(join(dir, 'package.json'), JSON.stringify({ name: 'vue', version, type: 'module', exports: { '.': './index.js', './*': './*' } }))
  await write(join(dir, 'index.js'), '')
}

async function createNuxt ({ declared, nuxtVue, appVue }: { declared: string, nuxtVue: string, appVue?: string }) {
  const rootDir = join(tmpDir, `${declared}-${appVue ?? 'none'}`.replaceAll(/[^\w.-]/g, '_'))
  const nuxtDir = join(rootDir, 'node_modules/.pnpm/nuxt@1.0.0/node_modules/nuxt')
  await write(join(nuxtDir, 'package.json'), JSON.stringify({ name: 'nuxt', version: '1.0.0', type: 'module', exports: { '.': './dist/index.js', './package.json': './package.json' }, dependencies: { vue: declared } }))
  await mkdir(join(nuxtDir, 'dist/app'), { recursive: true })
  await writeVue(join(nuxtDir, 'node_modules/vue'), nuxtVue)
  await symlink(nuxtDir, join(rootDir, 'node_modules/nuxt'), 'junction')
  if (appVue) {
    await writeVue(join(rootDir, 'node_modules/vue'), appVue)
  }
  return { options: { rootDir, appDir: join(nuxtDir, 'dist/app') } } as unknown as Nuxt
}

function check (nuxt: Nuxt) {
  const report = vi.spyOn(bundlerDiagnostics, 'NUXT_B7042').mockImplementation(() => ({}) as any)
  checkVueVersion(nuxt)
  return report
}

it('warns when the app resolves an older copy of vue', async () => {
  const report = check(await createNuxt({ declared: '^3.5.45', nuxtVue: '3.5.45', appVue: '3.5.30' }))
  expect(report.mock.calls).toMatchObject([[{ version: '3.5.30', expected: '^3.5.45' }]])
  report.mockRestore()
})

it.each(['3.5.45', '3.5.46', '3.6.0-beta.1'])('stays quiet when the app resolves vue@%s', async (appVue) => {
  const report = check(await createNuxt({ declared: '^3.5.45', nuxtVue: '3.5.45', appVue }))
  expect(report.mock.calls).toStrictEqual([])
  report.mockRestore()
})

it('stays quiet when the app has no vue of its own', async () => {
  const report = check(await createNuxt({ declared: '^3.5.45', nuxtVue: '3.5.30' }))
  expect(report.mock.calls).toStrictEqual([])
  report.mockRestore()
})

it.each(['catalog:app-runtime', '*'])('compares against the copy nuxt resolves when it declares `%s`', async (declared) => {
  const older = check(await createNuxt({ declared, nuxtVue: '3.5.45', appVue: '3.5.30' }))
  expect(older.mock.calls).toMatchObject([[{ version: '3.5.30', expected: '3.5.45' }]])
  older.mockRestore()

  const same = check(await createNuxt({ declared, nuxtVue: '3.5.45', appVue: '3.5.45' }))
  expect(same.mock.calls).toStrictEqual([])
  same.mockRestore()
})
