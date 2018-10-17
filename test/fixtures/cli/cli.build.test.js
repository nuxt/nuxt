import { exec } from 'child_process'
import { resolve } from 'path'
import { promisify } from 'util'

const execify = promisify(exec)
const rootDir = __dirname
const nuxtBin = resolve(__dirname, '../../../packages/cli/bin/nuxt.js')

describe.skip.appveyor('cli build', () => {
  test('nuxt build', async () => {
    const { stdout } = await execify(`node ${nuxtBin} build ${rootDir} -c cli.build.config.js`)

    expect(stdout.includes('Compiled successfully')).toBe(true)
  }, 80000)

  test('nuxt build -> error config', async () => {
    await expect(execify(`node -r esm ${nuxtBin} build ${rootDir} -c config.js`)).rejects.toMatchObject({
      stdout: expect.stringContaining('Could not load config file: config.js')
    })
  })
})
