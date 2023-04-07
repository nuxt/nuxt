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

    // Since 3.4.0, devtools is shipped with Nuxt, so we can use the local version instead of the latest
    const pkg = currentVersion.startsWith('3.4.')
      ? '@nuxt/devtools'
      : '@nuxt/devtools@latest'

    await execa('npx', [pkg, command, rootDir], { stdio: 'inherit', cwd: rootDir })
  }
})
