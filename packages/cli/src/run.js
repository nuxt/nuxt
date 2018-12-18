
import { execSync } from 'child_process'
import consola from 'consola'
import NuxtCommand from './command'
import listCommands from './list'
import setup from './setup'

export default async function run(custom = null) {
  if (custom) {
    try {
      await custom.run()
    } catch (error) {
      consola.fatal(error)
    }
    return
  }

  const cmd = process.argv[2] || 'dev'
  try {
    const external = await NuxtCommand.ensure(cmd)

    if (external) {
      console.log('external', external)
      const stdio = [
        process.stdin,
        process.stdout,
        process.stderr
      ]
      execSync(external, { stdio })
      return
    }
  } catch (notFoundError) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return listCommands().then(() => process.exit(0))
    } else {
      throw notFoundError
    }
  }

  process.argv.splice(2, 1)
  setup({ dev: cmd === 'dev' })

  try {
    await NuxtCommand.run(cmd)
  } catch (error) {
    consola.fatal(error)
  }
}
