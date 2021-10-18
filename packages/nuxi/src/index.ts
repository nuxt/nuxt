import mri from 'mri'
import { red, cyan } from 'colorette'
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
  let command = args._.shift() || 'usage'

  showBanner(command === 'dev' && args.clear !== false)

  if (!(command in commands)) {
    console.log('\n' + red('Invalid command ' + command))
    command = 'usage'
  }

  // Check Node.js version in background
  setTimeout(() => { checkEngines() }, 1000)

  if (command === 'usage') {
    console.log(`\nUsage: ${cyan(`npx nuxi ${Object.keys(commands).join('|')} [args]`)}\n`)
    process.exit(1)
  }

  try {
    // @ts-ignore default.default is hotfix for #621
    const cmd = await commands[command as Command]() as NuxtCommand
    if (args.h || args.help) {
      showHelp(cmd.meta)
    } else {
      await cmd.invoke(args)
    }
  } catch (err) {
    onFatalError(err)
  }
}

function onFatalError (err: unknown) {
  consola.error(err)
  process.exit(1)
}

// Wrap all console logs with consola for better DX
consola.wrapConsole()

process.on('unhandledRejection', err => consola.error('[unhandledRejection]', err))
process.on('uncaughtException', err => consola.error('[uncaughtException]', err))

export function main () {
  _main().catch(onFatalError)
}
