
import { resolve } from 'path'
import { requireModule } from '../utils/cjs'

export async function invoke (args) {
  const rootDir = resolve(args._[0] || '.')

  const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir)

  const nuxt = await loadNuxt({ rootDir })
  await buildNuxt(nuxt)
}

export const meta = {
  usage: 'nu build [rootDir]',
  description: 'Build nuxt for production deployment'
}
