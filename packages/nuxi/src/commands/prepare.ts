import { relative, resolve } from 'pathe'
import { consola } from 'consola'

// we are deliberately inlining this code as a backup in case user has `@nuxt/schema<3.7`
import { writeTypes as writeTypesLegacy } from '../../../kit/src/template'
import { clearBuildDir } from '../utils/fs'
import { loadKit } from '../utils/kit'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'prepare',
    usage: 'npx nuxi prepare [--log-level] [rootDir]',
    description: 'Prepare nuxt for development/build'
  },
  async invoke (args, options = {}) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt, buildNuxt, writeTypes = writeTypesLegacy } = await loadKit(rootDir)
    const nuxt = await loadNuxt({
      rootDir,
      overrides: {
        _prepare: true,
        logLevel: args['log-level'],
        ...(options.overrides || {})
      }
    })
    await clearBuildDir(nuxt.options.buildDir)

    await buildNuxt(nuxt)
    await writeTypes(nuxt)
    consola.success('Types generated in', relative(process.cwd(), nuxt.options.buildDir))
  }
})
