import { resolve } from 'pathe'
import { execa } from 'execa'
import { showHelp } from '../utils/help'
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

    await execa('npx', ['@nuxt/devtools-wizard', command, rootDir], { stdio: 'inherit', cwd: rootDir })
  }
})
