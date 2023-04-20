import { execa } from 'execa'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { tryResolveModule } from '../utils/esm'
import { defineNuxtCommand } from './index'

const MODULE_BUILDER_PKG = '@nuxt/module-builder'

export default defineNuxtCommand({
  meta: {
    name: 'build-module',
    usage: 'npx nuxi build-module [--stub] [rootDir]',
    description: `Helper command for using ${MODULE_BUILDER_PKG}`
  },
  async invoke (args) {
    // Find local installed version
    const rootDir = resolve(args._[0] || '.')
    const hasLocal = await tryResolveModule(`${MODULE_BUILDER_PKG}/package.json`, rootDir)

    const execArgs = Object.entries({
      '--stub': args.stub
    }).filter(([, value]) => value).map(([key]) => key)

    let cmd = 'nuxt-module-build'
    if (!hasLocal) {
      consola.warn(`Cannot find locally installed version of \`${MODULE_BUILDER_PKG}\` (>=0.2.0). Falling back to \`npx ${MODULE_BUILDER_PKG}\``)
      cmd = 'npx'
      execArgs.unshift(MODULE_BUILDER_PKG)
    }

    await execa(cmd, execArgs, { preferLocal: true, stdio: 'inherit', cwd: rootDir })
  }
})
