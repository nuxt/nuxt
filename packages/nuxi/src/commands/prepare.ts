import { resolve } from 'pathe'
import { loadKit } from '../utils/kit'
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

    const { loadNuxt } = await loadKit(rootDir)
    const nuxt = await loadNuxt({ rootDir })

    await writeTypes(nuxt)
  }
})
