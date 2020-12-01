import { existsSync } from 'fs'
import { resolve } from 'path'
import execa from 'execa'
import consola from 'consola'
import { name as pkgName } from '../package.json'
import NuxtCommand from './command'
import setup from './setup'
import getCommand from './commands'
import { isNuxtDir } from './utils/dir'

export default async function run (_argv, hooks = {}) {
  // Check for not installing both nuxt and nuxt-edge
  const dupPkg = pkgName === '@nuxt/cli-edge' ? 'cli' : 'cli-edge'
  const dupPkgJSON = resolve(__dirname, '../..' /* dist/../.. */, dupPkg, 'package.json')
  if (existsSync(dupPkgJSON) && require(dupPkgJSON).name !== '@nuxt/' + dupPkg) {
    consola.warn('Both `nuxt` and `nuxt-edge` dependencies are installed! Please choose one and remove the other one from dependencies.')
  }

  // Read from process.argv
  const argv = _argv ? Array.from(_argv) : process.argv.slice(2)

  // Check for internal command
  let cmd = await getCommand(argv[0])

  // Matching `nuxt` or `nuxt [dir]` or `nuxt -*` for `nuxt dev` shortcut
  if (!cmd && (!argv[0] || argv[0][0] === '-' || isNuxtDir(argv[0]))) {
    argv.unshift('dev')
    cmd = await getCommand('dev')
  }

  // Check for dev
  const dev = argv[0] === 'dev'

  // Setup env
  setup({ dev })

  // Try internal command
  if (cmd) {
    return NuxtCommand.run(cmd, argv.slice(1), hooks)
  }

  // Try external command
  try {
    await execa(`nuxt-${argv[0]}`, argv.slice(1), {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin: process.stdin
    })
  } catch (error) {
    if (error.exitCode === 2) {
      throw String(`Command not found: nuxt-${argv[0]}`)
    }
    throw String(`Failed to run command \`nuxt-${argv[0]}\`:\n${error}`)
  }
}
