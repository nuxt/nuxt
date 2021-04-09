import { buildNuxt, loadNuxt } from '../utils/nuxt'

export async function invoke (args) {
  const nuxt = await loadNuxt({
    rootDir: args._[0],
    for: 'build'
  })

  await buildNuxt(nuxt)
}

export const meta = {
  usage: 'nu build [rootDir]',
  description: 'Build nuxt for production deployment'
}
