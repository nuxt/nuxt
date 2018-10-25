import { exec } from 'child_process'
import { resolve } from 'path'
import { promisify } from 'util'

const execify = promisify(exec)
const rootDir = __dirname
const nuxtBin = resolve(__dirname, '../../../packages/cli/bin/nuxt.js')

describe('cli generate', () => {
  test('nuxt generate', async () => {
    const { stdout } = await execify(`node -r esm ${nuxtBin} generate ${rootDir} -c cli.gen.config.js`)

    expect(stdout.includes('Generated successfully')).toBe(true)
  }, 80000)
})
