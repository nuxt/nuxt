import { NuxtCommand, commands } from '@nuxt/cli'
import consola from 'consola'

describe('cli build', () => {
  test('nuxt build', async () => {
    const buildCommand = await commands.default('build')

    const argv = [
      __dirname,
      '--no-force-exit',
      '-c',
      'cli.build.config.js'
    ]

    const cmd = new NuxtCommand(buildCommand, argv)
    await expect(cmd.run()).resolves.toBeUndefined()

    expect(consola.log).toBeCalledWith('Compiled successfully')
  })
})
