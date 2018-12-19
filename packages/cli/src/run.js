import consola from 'consola'
import execa from 'execa'
import NuxtCommand from './command'
import setup from './setup'
import getCommand from './commands'
import { normalizeArgv, parseArgv, plainError } from './utils'

export default async function run(customCommand) {
  // Read from process.argv
  const argv = normalizeArgv(process.argv)

  // Setup env
  setup({
    dev: argv[0] === 'dev' || argv[0] === 'default'
  })

  // Run customCommand if provided
  if (customCommand) {
    if (typeof customCommand === 'string') {
      argv[0] = customCommand
    } else {
      return NuxtCommand.run(customCommand)
    }
  }

  // Try internal command
  const cmd = await getCommand(argv[0])
  if (cmd) {
    return NuxtCommand.run(cmd)
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
