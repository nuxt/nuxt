import { resolve } from 'pathe'
import { execa } from 'execa'
import { showHelp } from '../utils/help'
import { getNuxtVersion } from './upgrade'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'enable',
    usage: 'npx nuxi devtools enable|disable [rootDir]',
    description: 'Enable or disable features in a Nuxt project'
  },
  async invoke (args) {
    const [command, _rootDir = '.'] = args._
    const rootDir = resolve(_rootDir)

    if (!['enable', 'disable'].includes(command)) {
      console.error(`Unknown command \`${command}\`.`)
      showHelp(this.meta)
      process.exit(1)
    }

    const currentVersion = await getNuxtVersion(rootDir) || '[unknown]'
    // Since 3.4.0, devtools is shipped with Nuxt
    if (!currentVersion.startsWith('3.4.')) {
      // TODO: write to nuxt.config to set `devtools: true`
    } else {
      // Defer to feature setup
      await execa('npx', ['@nuxt/devtools@latest', command, rootDir], { stdio: 'inherit', cwd: rootDir })
    }
  }
})
