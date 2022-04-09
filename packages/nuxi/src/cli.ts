import mri from 'mri'
import { red } from 'colorette'
import consola from 'consola'
import { checkEngines } from './utils/engines'
import { commands, Command, NuxtCommand } from './commands'
import { showHelp } from './utils/help'
import { showBanner } from './utils/banner'

async function _main () {
  const _argv = process.argv.slice(2)
  const args = mri(_argv, {
    boolean: [
      'no-clear'
    ]
  })
  // @ts-ignore
  const command = args._.shift() || 'usage'

  showBanner(command === 'dev' && args.clear !== false && !args.help)

  if (!(command in commands)) {
    console.log('\n' + red('Invalid command ' + command))

    await commands.usage().then(r => r.invoke())
    process.exit(1)
  }

  // Check Node.js version in background
  setTimeout(() => { checkEngines().catch(() => {}) }, 1000)

  // @ts-ignore default.default is hotfix for #621
  const cmd = await commands[command as Command]() as NuxtCommand
  if (args.h || args.help) {
    showHelp(cmd.meta)
  } else {
    const result = await cmd.invoke(args)
    return result
  }
}

// Wrap all console logs with consola for better DX
consola.wrapConsole()

process.on('unhandledRejection', err => consola.error('[unhandledRejection]', err))
process.on('uncaughtException', err => consola.error('[uncaughtException]', err))

export function main () {
  _main()
    .then((result) => {
      if (result === 'error') {
        process.exit(1)
      } else if (result !== 'wait') {
        process.exit(0)
      }
    })
    .catch((error) => {
      consola.error(error)
      process.exit(1)
    })
}
