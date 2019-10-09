import { NuxtCommand, commands } from '@nuxt/cli'
import consola from 'consola'

describe('cli generate', () => {
  test('nuxt generate', async () => {
    const generateCommand = await commands.default('generate')

    const argv = [
      __dirname,
      '--no-force-exit',
      '-c',
      'cli.gen.config.js'
    ]

    const cmd = new NuxtCommand(generateCommand, argv)
    await expect(cmd.run()).resolves.toBeUndefined()

    expect(consola.log).toBeCalledWith('Generated successfully')
  })
})
