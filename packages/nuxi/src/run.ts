import mri from 'mri'
import { commands, Command, NuxtCommand } from './commands'

export async function runCommand (command: string, argv = process.argv.slice(2)) {
  const args = mri(argv)
  args.clear = false // used by dev
  const cmd = await commands[command as Command]() as NuxtCommand
  if (!cmd) {
    throw new Error(`Invalid command ${command}`)
  }
  await cmd.invoke(args)
}
