import { spawn } from 'child_process'
import { resolve } from 'path'
import { getPort, rp, waitUntil } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route
const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')
const genHandlers = (cmd) => {
  cmd.on()
}

const killNuxt = async (nuxtInt) => {
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
}

describe.skip.appveyor('cli', () => {

  test('nuxt dev', async () => {
    let stdout = ''
    let exitcode
    const env = process.env
    env.PORT = port = await getPort()

    const nuxtDev = spawn('node', [nuxtBin, 'dev', rootDir], { env })
    nuxtDev.stdout.on('data', data => { stdout += data })
    nuxtStart.on('close', code => { exitCode = code })
    
    const customFilePath = join(rootDir, 'custom.file')
    await writeFile(customFilePath, 'This file is used to test custom chokidar watchers.')
    await new Promise((resolve) => setTimeout(() => resolve()), 200)
    expect(stdout.includes('[custom.file] changed')).toBe(true)

    await killNuxt(nuxtStart)    
    expect(exitCode).toBe(null)

  })

  test('nuxt start', async () => {
    let stdout = ''
    let error
    let exitCode

    const env = process.env
    env.PORT = port = await getPort()

    const nuxtStart = spawn('node', [nuxtBin, 'start', rootDir], { env })

    nuxtStart.stdout.on('data', data => { stdout += data })
    nuxtStart.on('error', err => { error = err })
    nuxtStart.on('close', code => { exitCode = code })

    // Wait max 20s for the starting
    let timeout = await waitUntil(() => stdout.includes('Listening on'))

    if (timeout === true) {
      error = 'server failed to start successfully in 20 seconds'
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('Listening on')).toBe(true)

    const html = await rp(url('/'))
    expect(html).toMatch(('<div>CLI Test</div>'))

    await killNuxt(nuxtStart)

    expect(exitCode).toBe(null)
  })
})
