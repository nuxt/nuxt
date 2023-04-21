import { relative, resolve } from 'pathe'
import { consola } from 'consola'
import { clearBuildDir } from '../utils/fs'
import { loadKit } from '../utils/kit'
import { writeTypes } from '../utils/prepare'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'prepare',
    usage: 'npx nuxi prepare [--log-level] [rootDir]',
    description: 'Prepare nuxt for development/build'
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
    await clearBuildDir(nuxt.options.buildDir)

    await buildNuxt(nuxt)
    await writeTypes(nuxt)
    consola.success('Types generated in', relative(process.cwd(), nuxt.options.buildDir))
  }
})
