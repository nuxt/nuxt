import { spawn } from 'child_process'
import { resolve } from 'path'
import { getPort, rp, waitUntil } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')

describe.skip.appveyor('cli', () => {
  test('nuxt dev', async () => {
    let stdout = ''
    let error
    let exitCode

    const env = process.env
    env.PORT = port = await getPort()

    const nuxtDev = spawn('node', [nuxtBin, 'dev', rootDir], { env })
    nuxtDev.stdout.on('data', (data) => stdout += data)
    nuxtDev.on('error', (err) => error = err)
    nuxtDev.on('close', (code) => exitCode = code)

    // Wait max 20s for the starting
    let timeout = await waitUntil(() => stdout.includes('Listening on'))

    if (timeout === true) {
      error = 'server failed to start successfully in 20 seconds'
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('Listening on ')).toBe(true)
    expect(stdout.includes(`http://localhost:${port}`)).toBe(true)

    const customFilePath = path.join(rootDir, 'custom.file')
    fs.writeFileSync(customFilePath, 'Added contents.')

    expect(stdout.includes('[custom.file] changed')).toBe(true)

    nuxtDev.kill()

    expect(stdout.includes('Listening on ')).toBe(true)

    // Wait max 10s for the process to be killed
    timeout = await waitUntil(() => exitCode !== undefined, 10)

    if (timeout === true) {
      console.warn( // eslint-disable-line no-console
        `we were unable to automatically kill the child process with pid: ${
          nuxtDev.pid
        }`
      )
    }

    expect(exitCode).toBe(null)
  })
})
