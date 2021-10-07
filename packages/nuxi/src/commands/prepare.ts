import { resolve } from 'pathe'
import { importModule } from '../utils/cjs'
import { writeTypes } from '../utils/prepare'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'prepare',
    usage: 'npx nuxi prepare',
    description: 'Prepare nuxt for development/build'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt } = await importModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')
    const nuxt = await loadNuxt({ rootDir })

    await writeTypes(nuxt)
  }
})
