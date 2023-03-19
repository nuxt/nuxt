import { execa } from 'execa'
import { resolve } from 'pathe'
import { tryResolveModule } from '../utils/esm'

import { loadKit } from '../utils/kit'
import { writeTypes } from '../utils/prepare'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'typecheck',
    usage: 'npx nuxi typecheck [--log-level] [rootDir]',
    description: 'Runs `vue-tsc` to check types throughout your app.'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt, buildNuxt } = await loadKit(rootDir)
    const nuxt = await loadNuxt({
      rootDir,
      overrides: {
        _prepare: true,
        logLevel: args['log-level']
      }
    })

    // Generate types and build nuxt instance
    await writeTypes(nuxt)
    await buildNuxt(nuxt)
    await nuxt.close()

    // Prefer local install if possible
    const hasLocalInstall = await tryResolveModule('typescript', rootDir) && await tryResolveModule('vue-tsc/package.json', rootDir)
    if (hasLocalInstall) {
      await execa('vue-tsc', ['--noEmit'], { preferLocal: true, stdio: 'inherit', cwd: rootDir })
    } else {
      await execa('npx', '-p vue-tsc -p typescript vue-tsc --noEmit'.split(' '), { stdio: 'inherit', cwd: rootDir })
    }
  }
})
