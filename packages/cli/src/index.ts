import 'v8-compile-cache'
import mri from 'mri'
import { red, cyan, green } from 'colorette'
import { version } from '../package.json'
import { commands } from './commands'
import { showHelp } from './utils/help'

async function _main () {
  const _argv = process.argv.slice(2)
  const args = mri(_argv)
  // @ts-ignore
  let command = args._.shift() || 'usage'

  console.log(green(`Nuxt CLI v${version}`))

  if (!(command in commands)) {
    console.log('\n' + red('Invalid command ' + command))
    command = 'usage'
  }

  if (command === 'usage') {
    console.log(`\nUsage: ${cyan(`nu ${Object.keys(commands).join('|')} [args]`)}\n`)
    process.exit(1)
  }

  try {
    const cmd = await commands[command]()
    if (args.h || args.help) {
      showHelp(cmd.meta)
    } else {
      await cmd.invoke(args)
    }
  } catch (err) {
    onFatalError(err)
  }
}

function onFatalError (err) {
  console.error(err)
  process.exit(1)
}

export function main () {
  _main().catch(onFatalError)
}
