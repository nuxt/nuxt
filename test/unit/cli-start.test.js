import { spawn } from 'child_process'
import { resolve } from 'path'
import { getPort, rp, waitUntil } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')

describe('cli', () => {
  test('nuxt start', async () => {
    let stdout = ''
    let error
    let exitCode

    const env = process.env
    env.PORT = port = await getPort()

    const nuxtStart = spawn('node', [nuxtBin, 'start', rootDir], { env })

    nuxtStart.stdout.on('data', data => {
      stdout += data
    })

    nuxtStart.on('error', err => {
      error = err
    })

    nuxtStart.on('close', code => {
      exitCode = code
    })

    // Wait max 20s for the starting
    let timeout = await waitUntil(() => stdout.includes('Listening on'))

    if (timeout === true) {
      error = 'server failed to start successfully in 20 seconds'
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('Listening on')).toBe(true)

    const html = await rp(url('/'))
    expect(html).toMatch(('<div>CLI Test</div>'))

    nuxtStart.kill()

    // Wait max 10s for the process to be killed
    timeout = await waitUntil(() => exitCode !== undefined, 10)

    if (timeout === true) {
      console.warn( // eslint-disable-line no-console
        `we were unable to automatically kill the child process with pid: ${
          nuxtStart.pid
        }`
      )
    }

    expect(exitCode).toBe(null)
  })
})
