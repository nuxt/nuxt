import buildCommand from './build'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'generate',
    usage: 'npx nuxi generate [rootDir]',
    description: 'Build Nuxt and prerender static routes'
  },
  async invoke (args) {
    args.prerender = true
    await buildCommand.invoke(args)
  }
})
