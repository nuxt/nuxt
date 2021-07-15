
import { resolve } from 'upath'
import { requireModule } from '../utils/cjs'
import { error } from '../utils/log'

export async function invoke (args) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production'
  const rootDir = resolve(args._[0] || '.')

  const { loadNuxt, buildNuxt } = requireModule('@nuxt/kit', rootDir)

  const nuxt = await loadNuxt({ rootDir })

  nuxt.hook('error', (err) => {
    error('Nuxt Build Error:', err)
    process.exit(1)
  })

  await buildNuxt(nuxt)
}

export const meta = {
  usage: 'nu build [rootDir]',
  description: 'Build nuxt for production deployment'
}
