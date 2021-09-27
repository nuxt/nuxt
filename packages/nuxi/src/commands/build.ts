import { resolve } from 'pathe'
import { requireModule } from '../utils/cjs'
import { error } from '../utils/log'

import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'build',
    usage: 'npx nuxi build [rootDir]',
    description: 'Build nuxt for production deployment'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')

    const nuxt = await loadNuxt({ rootDir })

    nuxt.hook('error', (err) => {
      error('Nuxt Build Error:', err)
      process.exit(1)
    })

    await buildNuxt(nuxt)
  }
})
