import { resolve } from 'pathe'
import { cleanupNuxtDirs } from '../utils/nuxt'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'cleanup',
    usage: 'npx nuxi clean|cleanup',
    description: 'Cleanup generated nuxt files and caches'
  },
  async invoke (args) {
    const rootDir = resolve(args._[0] || '.')
    await cleanupNuxtDirs(rootDir)
  }
})
