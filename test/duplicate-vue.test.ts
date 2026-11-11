import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'

import { isBuilt, runsOncePerBuildInMatrix } from './matrix'
import { setupFixture } from './utils'

const fixtureURL = new URL('./fixtures/duplicate-vue/', import.meta.url)

/**
 * Install the fixture's `ui` package the way pnpm installs a package that imports Vue without
 * declaring it, with a second copy of `@vue/runtime-core` hoisted where that import resolves.
 */
function installPackageWithHoistedVue (rootDir: string) {
  const store = join(rootDir, 'node_modules/.pnpm')
  const dir = join(store, 'duplicate-vue-ui@0.0.0/node_modules/duplicate-vue-ui')
  const entry = readFileSync(join(rootDir, 'ui/index.js'), 'utf8')
  // the matrix projects share the fixture, and the entry is written last
  if (existsSync(join(dir, 'index.js')) && readFileSync(join(dir, 'index.js'), 'utf8') === entry) {
    return
  }

  const resolveDir = (id: string, from: string) => dirname(realpathSync(createRequire(join(from, 'package.json')).resolve(`${id}/package.json`)))
  const runtimeCore = resolveDir('@vue/runtime-core', resolveDir('@vue/runtime-dom', resolveDir('vue', rootDir)))
  for (const [id, source] of [['@vue/runtime-core', runtimeCore], ['@vue/reactivity', resolveDir('@vue/reactivity', runtimeCore)], ['@vue/shared', resolveDir('@vue/shared', runtimeCore)]] as const) {
    cpSync(source, join(store, 'node_modules', id), { recursive: true, dereference: true })
  }

  mkdirSync(dir, { recursive: true })
  if (!existsSync(join(rootDir, 'node_modules/duplicate-vue-ui'))) {
    symlinkSync(dir, join(rootDir, 'node_modules/duplicate-vue-ui'), 'dir')
  }
  cpSync(join(rootDir, 'ui/package.json'), join(dir, 'package.json'))
  writeFileSync(join(dir, 'index.js'), entry)
}

const runs = runsOncePerBuildInMatrix && isBuilt

if (runs) {
  installPackageWithHoistedVue(fileURLToPath(fixtureURL))
}

await setupFixture(fixtureURL, runs)

describe.skipIf(!runs)('a package that imports vue without declaring it', () => {
  it('renders on the same copy of vue as the app', async () => {
    expect(await $fetch<string>('/')).toContain('<div><!--[-->rendered slot<!--]--></div>')
  })
})
