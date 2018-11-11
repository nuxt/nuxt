import consola from 'consola'

export default {
  name: 'my-custom-command',
  description: 'My Custom Command',
  usage: 'my-custom-command <foobar>',
  options: {
    foobar: {
      alias: 'fb',
      type: 'string',
      description: 'Simple test string'
    }
  },
  run(cmd) {
    try {
      const argv = cmd.getArgv()
      consola.info('argv: ', argv)
      process.exit(0)
    } catch (err) {
      consola.fatal(err)
    }
  }
}
