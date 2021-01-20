import { resolve } from 'path'
import { loadNuxt, build } from '.'

async function _main () {
  const rootDir = resolve(process.cwd(), process.argv[2] || '.')
  const nuxt = await loadNuxt({ for: 'dev', rootDir })
  const [{ url }] = await nuxt.server.listen(3000)
  console.log('Listening:', url)
  await build(nuxt)
}

export function main () {
  _main()
    .catch((error) => {
      require('consola').fatal(error)
      require('exit')(2)
    })
}
