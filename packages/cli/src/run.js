
import { spawn } from 'child_process'
import consola from 'consola'
import NuxtCommand from './command'
import listCommands from './list'
import setup from './setup'

export default async function run(custom = null) {
  if (custom) {
    await custom.run()
    return
  }

  const cmd = process.argv[2] || 'dev'
  console.log('!')
  const isExternal = await NuxtCommand.ensure(cmd)
  console.log('isExternal', isExternal)

  if (isExternal) {
    process.argv.splice(2, 1)
    try {
      spawn(process.argv[0], process.argv.slice(1))
    } catch (error) {
      consola.fatal(error)
    }
    return
  }
  // } catch (notFoundError) {
  //   if (process.argv.includes('--help') || process.argv.includes('-h')) {
  //     return listCommands().then(() => process.exit(0))
  //   } else {
  //     throw notFoundError
  //   }
  // }

  process.argv.splice(2, 1)
  setup({ dev: cmd === 'dev' })

  await NuxtCommand.run(cmd)
}
