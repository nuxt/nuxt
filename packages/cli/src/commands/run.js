import NuxtCommand from '../command'

export default {
  name: 'run',
  description: 'Run <customCmd> if available in this directory',
  usage: 'run <customCmd>',
  run(cmd) {
    const argv = cmd.getArgv()
    const customCmd = argv._[0]

    NuxtCommand.ensure(customCmd, '.')
    process.argv.splice(2, 1)

    return NuxtCommand.load(customCmd, '.')
      .then(command => command.run())
  }
}
