import NuxtCommand from '../command'

export default {
  name: 'run',
  description: 'Run locally defined commands in the root Nuxt project directory',
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
