/**
 * Child-process entry for the `no-jiti` tests.
 *
 * Usage: `node run-without-jiti.mjs <kitEntry> <task> <cwd...>`
 *
 * `task` is either `config` (load the config of every `cwd`) or `build` (load and build the first
 * `cwd`). Reports one `ok <cwd>` line per success and exits non-zero on the first failure, so the
 * test can attribute a failure to a specific fixture.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('block-jiti-loader.mjs', import.meta.url))

const [kitEntry, task, ...cwds] = process.argv.slice(2)

const kit = await import(pathToFileURL(kitEntry).href)

if (task === 'build') {
  const nuxt = await kit.loadNuxt({ cwd: cwds[0] })
  try {
    await kit.buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }
  console.log(`ok ${cwds[0]}`)
} else {
  for (const cwd of cwds) {
    const options = await kit.loadNuxtConfig({ cwd })
    if (!options.rootDir) {
      throw new Error(`no rootDir resolved for ${cwd}`)
    }
    console.log(`ok ${cwd}`)
  }
}
