import { resolve } from 'path'
import { loadNuxt, build } from '.'

async function _main () {
  const args = process.argv.splice(2)
  const cmd = args[0]
  if (!['dev', 'build'].includes(cmd)) {
    console.error('Usage nuxt dev|build [rootDir]')
    process.exit(1)
  }
  const isDev = cmd === 'dev'
  const rootDir = resolve(process.cwd(), args[1] || '.')
  const nuxt = await loadNuxt({ for: isDev ? 'dev' : 'build', rootDir })

  if (isDev) {
    // https://github.com/nuxt-contrib/listhen
    await nuxt.server.listen(3000, { name: 'Nuxt' })
  }

  await build(nuxt)
}

export function main () {
  _main()
    .catch((error) => {
      require('consola').fatal(error)
      require('exit')(2)
    })
}
