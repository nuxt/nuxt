import { resolve } from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import { spawn } from 'cross-spawn'
import { waitUntil } from '../utils'

const execAsync = promisify(exec)
const rootDir = resolve(__dirname, '..', 'fixtures/with-commands')
const nuxtBin = resolve(__dirname, '../../packages/cli/bin/nuxt.js')

function spawnNuxt(command, args) {
  return spawn(nuxtBin, [command, ...args], { cwd: rootDir })
}

describe('module commands', () => {
  beforeAll(async () => {
    await execAsync('yarn link', { cwd: rootDir })
    await execAsync('yarn link nuxt-module-example-with-commands')
  })

  test('loads and runs module commands', async () => {
    let stdout = ''
    const nuxtDev = spawnNuxt('foobar', ['command', '--foobar=123'])
    nuxtDev.stdout.on('data', (data) => { stdout += data })
    await waitUntil(() => stdout.includes('123'))
  })
})
