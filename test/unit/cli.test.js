import { spawn } from 'child_process'
import { resolve, join } from 'path'
import { writeFileSync } from 'fs-extra'
import { getPort, rp, waitUntil } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route
const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')

const close = async (nuxtInt) => {
  nuxtInt.kill('SIGKILL')
  // Wait max 10s for the process to be killed
  if (await waitUntil(() => nuxtInt.killed, 10)) {
    // eslint-disable-next-line no-console
    console.warn(`Unable to close process with pid: ${nuxtInt.pid}`)
  }
}

describe.skip.appveyor('cli', () => {
  test('nuxt dev', async () => {
    let stdout = ''
    const env = process.env
    env.PORT = port = await getPort()

    const nuxtDev = spawn('node', [nuxtBin, 'dev', rootDir], { env })
    nuxtDev.stdout.on('data', (data) => { stdout += data })

    // Wait max 20s for the starting
    await waitUntil(() => stdout.includes(`${port}`))

    // Change file specified in `watchers` (nuxt.config.js)
    const customFilePath = join(rootDir, 'custom.file')
    writeFileSync(customFilePath, 'This file is used to test custom chokidar watchers.')

    // Change file specified in `serverMiddleware` (nuxt.config.js)
    const customFilePath = join(rootDir, 'middleware.js')
    writeFileSync(customFilePath, '// This file is used to test custom chokidar watchers.')

    // Must see two compilations in the log
    expect(
      stdout.indexOf('Compiled client') !==
      stdout.lastIndexOf('Compiled client')
    )
    await close(nuxtDev)
  })

  test('nuxt start', async () => {
    let stdout = ''
    let error

    const env = process.env
    env.PORT = port = await getPort()

    await new Promise((resolve) => {
      const nuxtBuild = spawn('node', [nuxtBin, 'build', rootDir], { env })
      nuxtBuild.on('close', () => { resolve() })
    })

    const nuxtStart = spawn('node', [nuxtBin, 'start', rootDir], { env })

    nuxtStart.stdout.on('data', (data) => { stdout += data })
    nuxtStart.on('error', (err) => { error = err })

    // Wait max 20s for the starting
    if (await waitUntil(() => stdout.includes(`${port}`))) {
      error = 'server failed to start successfully in 20 seconds'
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('Listening on')).toBe(true)

    const html = await rp(url('/'))
    expect(html).toMatch(('<div>CLI Test</div>'))

    await close(nuxtStart)
  })
})
