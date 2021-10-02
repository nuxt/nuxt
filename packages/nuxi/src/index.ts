import mri from 'mri'
import { red, cyan } from 'colorette'
import { commands, Command, NuxtCommand } from './commands'
import { showHelp } from './utils/help'
import { showBanner } from './utils/banner'
import { error } from './utils/log'

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
  error(err)
  process.exit(1)
}

process.on('unhandledRejection', err => error('[unhandledRejection]', err))
process.on('uncaughtException', err => error('[uncaughtException]', err))

export function main () {
  _main().catch(onFatalError)
}
