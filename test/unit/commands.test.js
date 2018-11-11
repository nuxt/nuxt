import { resolve } from 'path'
import { spawn } from 'cross-spawn'
import { waitUntil } from '../utils'

const rootDir = resolve(__dirname, '..', 'fixtures/with-commands')
const nuxtBin = resolve(__dirname, '../../packages/cli/bin/nuxt.js')
const spawnNuxt = (command, args) => {
  spawn(nuxtBin, [command, rootDir], { cwd: rootDir })
}

describe('commands', () => {
  test('nuxt my-custom-command test-arg', async () => {
    let stdout = ''
    const nuxtDev = spawnNuxt('dev', { env })
    nuxtDev.stdout.on('data', (data) => { stdout += data })
    await waitUntil(() => stdout.includes('test-arg'))
  })
})
