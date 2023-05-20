import buildCommand from './build'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'generate',
    usage: 'npx nuxi generate [rootDir] [--dotenv]',
    description: 'Build Nuxt and prerender static routes'
  },
  async invoke (args, options = {}) {
    args.prerender = true
    await buildCommand.invoke(args, options)
  }
})
