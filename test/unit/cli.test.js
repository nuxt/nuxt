import { spawn } from 'child_process'
import { resolve, join } from 'path'
import { writeFile } from 'fs-extra'
import { getPort, rp, waitUntil } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route
const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')

const killNuxt = async (nuxtInt) => {
  let exitCode
  nuxtInt.kill()
  // Wait max 10s for the process to be killed
  let timeout = await waitUntil(() => exitCode !== undefined, 10)
  if (timeout === true) {
    console.warn( // eslint-disable-line no-console
      `we were unable to automatically kill the child process with pid: ${
        nuxtInt.pid
      }`
    )
  }
}

describe.skip.appveyor('cli', () => {

  test('nuxt dev', async () => {
    let stdout = ''
    let exitCode = null
    const env = process.env
    env.PORT = port = 4556 // await getPort()

    const nuxtDev = spawn('node', [nuxtBin, 'dev', rootDir], { env })
    nuxtDev.stdout.on('data', data => { stdout += data })
    nuxtDev.on('close', code => { exitCode = code })

    // Wait max 20s for the starting
    await waitUntil(() => stdout.includes(`${port}`), 20)

    // Change file specified in `watchers` (nuxt.config.js)
    const customFilePath = join(rootDir, 'custom.file')
    await writeFile(customFilePath, 'This file is used to test custom chokidar watchers.')

    // Wait until two compilations are seen
    // The first one and the one that followed the change to `custom.file`
    await waitUntil(() => {
      let index
      let compiles = 0
      let match = stdout.indexOf(/Compiled client/g)
      while (match !== -1) {
        compiles++
        match = stdout.indexOf(/Compiled client/g, match)
      }
      return compiles > 1
    })
    await writeFile('/tmp/now.txt', stdout)
    await killNuxt(nuxtDev)    
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
    let timeout = await waitUntil(() => stdout.includes('Listening on'), 20)

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
