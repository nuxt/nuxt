import { resolve } from 'pathe'
import { execa } from 'execa'
import { showHelp } from '../utils/help'
import { featureCLIs, isFeature } from '../utils/features'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'enable',
    usage: `npx nuxi enable|disable ${Object.keys(featureCLIs).join('|')} [rootDir]`,
    description: 'Enable or disable features in a Nuxt project'
  },
  async invoke (args) {
    const [feature, _rootDir = '.'] = args._
    const rootDir = resolve(_rootDir)

    if (!isFeature(feature)) {
      console.error(`Unknown feature. Supported features: ${Object.keys(featureCLIs).join(', ')}.`)
      showHelp(this.meta)
      process.exit(1)
    }

    // Defer to feature teardown
    await execa('npx', [featureCLIs[feature], 'disable', rootDir], { stdio: 'inherit', cwd: rootDir })
  }
})
