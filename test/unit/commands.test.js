import { resolve } from 'path'
import { spawn } from 'cross-spawn'
import { waitUntil } from '../utils'

const rootDir = resolve(__dirname, '..', 'fixtures/with-commands')
const nuxtBin = resolve(__dirname, '../../packages/cli/bin/nuxt.js')
const spawnNuxt = (command, args) => {
  return spawn(nuxtBin, ['run', command, ...args], { cwd: rootDir })
}

describe('custom commands', () => {
  test('loads and run custom commands', async () => {
    let stdout = ''
    const nuxtDev = spawnNuxt('my-custom-command', ['test-arg'])
    nuxtDev.stdout.on('data', (data) => { stdout += data })
    await waitUntil(() => stdout.includes('test-arg'))
  })
})
