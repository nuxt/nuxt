import { readFileSync } from 'node:fs'
import { getAddDependencyCommand } from '@nuxt/kit'
import { buildDiagnostics } from '@nuxt/kit/internal'
import { resolveModulePath } from 'exsolve'
import { withTrailingSlash } from 'ufo'
import { satisfies } from 'verkit'
import type { Nuxt } from 'nuxt/schema'

import pkg from '../../package.json' with { type: 'json' }

export async function checkVueVersion (nuxt: Nuxt) {
  const range = pkg.peerDependencies.vue
  const path = resolveModulePath('vue/package.json', { from: withTrailingSlash(nuxt.options.appDir), try: true })
  const version: string | undefined = path && JSON.parse(readFileSync(path, 'utf8')).version
  if (!version || satisfies(version, range)) { return }
  buildDiagnostics.NUXT_B1023({ version, range, installCommand: await getAddDependencyCommand('vue', nuxt.options.rootDir) })
}
