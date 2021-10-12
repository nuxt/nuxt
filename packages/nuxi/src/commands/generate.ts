import { resolve } from 'pathe'
import { isNuxt3 } from '@nuxt/kit'
import { importModule } from '../utils/cjs'

import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'generate',
    usage: 'npx nuxi generate [rootDir]',
    description: ''
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt } = await importModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')
    const nuxt = await loadNuxt({ rootDir })

    if (isNuxt3(nuxt)) {
      throw new Error('`nuxt generate` is not supported in Nuxt 3. Please follow this RFC: https://git.io/JKfvx')
    } else {
      throw new Error('Please use `nuxt generate` for Nuxt 2 instead of `nuxi generate`')
    }
  }
})
