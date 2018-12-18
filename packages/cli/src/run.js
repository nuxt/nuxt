import consola from 'consola'
import execa from 'execa'
import NuxtCommand from './command'
import listCommands from './list'
import setup from './setup'
import getCommand from './commands'
import { normalizeArgv, parseArgv, plainError } from './utils'

async function _run(customCommand) {
  const argv = normalizeArgv(process.argv)

  // isHelp, isDev
  const help = argv.includes('--help') || argv.includes('-h')
  const dev = !argv[0] || argv[0] === 'dev'

  // Setup env
  setup({ dev })

  // Execute customCommand if provided
  if (customCommand) {
    return customCommand.run({ argv, help })
  }

  // Try internal command
  const cmd = await getCommand(argv[0] || 'dev')
  if (cmd) {
    return NuxtCommand.run(cmd)
  }

  // Show help
  if (help) {
    return listCommands()
  }

  // Try external command
  const external = parseArgv(argv)
  try {
    await execa(`nuxt-${external.command}`, external.opts, {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin: process.stdin
    })
    process.exit(0)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw plainError(`Command not found: ${argv[0]}`)
    } else {
      throw plainError(`Failed to run command \`${argv[0]}\`:\n${error}`)
    }
  }
}

export default async function run(...args) {
  try {
    await _run(...args)
  } catch (error) {
    consola.fatal(error)
    process.exit(1)
  }
}
