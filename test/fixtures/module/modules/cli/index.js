import consola from 'consola'

export const cli = {
  name: 'custom-module-cli',
  description: 'CLI commands for custom-module',
  commands: [
    {
      name: 'command',
      run() {
        consola.info('dummy module command')
      },
      options: {
        dummy: {
          alias: 'd',
          type: 'boolean',
          description: 'Dummy option',
          handle(options, argv) {
            consola.info('argv ->', argv)
          }
        }
      }
    }
  ]
}

export default function () {
  consola.info('dummy module')
}
