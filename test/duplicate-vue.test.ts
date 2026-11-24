import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
  const pkg = 'duplicate-vue-ui@0.0.0/node_modules/duplicate-vue-ui'
  const installed = join(store, pkg, 'index.js')
  const entry = readFileSync(join(rootDir, 'ui/index.js'), 'utf8')
  const isStale = () => existsSync(installed) && readFileSync(installed, 'utf8') !== entry

  // the matrix projects share the fixture, so each writes the store aside and the first to move it into place wins
  if (!existsSync(installed) || isStale()) {
    const staging = mkdtempSync(join(rootDir, 'node_modules/.pnpm-'))
    const resolveDir = (id: string, from: string) => dirname(realpathSync(createRequire(join(from, 'package.json')).resolve(`${id}/package.json`)))
    const runtimeCore = resolveDir('@vue/runtime-core', resolveDir('@vue/runtime-dom', resolveDir('vue', rootDir)))
    for (const [id, source] of [['@vue/runtime-core', runtimeCore], ['@vue/reactivity', resolveDir('@vue/reactivity', runtimeCore)], ['@vue/shared', resolveDir('@vue/shared', runtimeCore)]] as const) {
      cpSync(source, join(staging, 'node_modules', id), { recursive: true, dereference: true })
    }
    mkdirSync(join(staging, pkg), { recursive: true })
    cpSync(join(rootDir, 'ui/package.json'), join(staging, pkg, 'package.json'))
    writeFileSync(join(staging, pkg, 'index.js'), entry)

    if (isStale()) {
      rmSync(store, { recursive: true, force: true })
    }
    try {
      renameSync(staging, store)
    } catch (error) {
      rmSync(staging, { recursive: true, force: true })
      if (!existsSync(installed)) {
        throw error
      }
    }
  }

  try {
    symlinkSync(join(store, pkg), join(rootDir, 'node_modules/duplicate-vue-ui'), 'junction')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
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
