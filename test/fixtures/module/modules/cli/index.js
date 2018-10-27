
export const cli = {
  name: 'custom-module-cli',
  description: 'CLI commands for custom-module',
  commands: [
    {
      name: 'command',
      async run () {
        console.log('dummy module command')
      },
      options: {
        dummy: {
          alias: 'd',
          type: 'boolean',
          description: 'Dummy option',
          handle(options, argv) {
            console.log('argv ->', argv)
          }
        },
      }
    }
  ]
}

export default function () {
  console.log('dummy module')
}
