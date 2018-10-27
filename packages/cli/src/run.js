import consola from 'consola'
import * as commands from './commands'
import setup from './setup'
import { build } from 'gluegun'
import moduleCommand from './commands/module'

const cli = build('nuxt')
  .src(__dirname)
  .command(moduleCommand)
  .defaultCommand()
  .create()

export default async function run() {
  await cli.run()
}
