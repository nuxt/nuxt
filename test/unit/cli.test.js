import { resolve, join } from 'path'
import { spawn } from 'cross-spawn'
import { writeFileSync } from 'fs-extra'
import { getPort, rp, waitUntil, Utils } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '../../packages/cli/bin/nuxt.js')
const spawnNuxt = (command, opts) => spawn('node', ['-r', 'esm', nuxtBin, command, rootDir], opts)

const close = async (nuxtInt) => {
  nuxtInt.kill('SIGKILL')
  // Wait max 10s for the process to be killed
  if (await waitUntil(() => nuxtInt.killed, 10)) {
    // eslint-disable-next-line no-console
    console.warn(`Unable to close process with pid: ${nuxtInt.pid}`)
  }
}

describe('cli', () => {
  test('nuxt dev', async () => {
    let stdout = ''
    const env = process.env
    env.PORT = port = await getPort()

    const nuxtDev = spawnNuxt('dev', { env })
    nuxtDev.stdout.on('data', (data) => { stdout += data })

    // Wait max 20s for the starting
    await waitUntil(() => stdout.includes(`${port}`))

    // Change file specified in `watchers` (nuxt.config.js)
    const customFilePath = join(rootDir, 'custom.file')
    writeFileSync(customFilePath, 'This file is used to test custom chokidar watchers.')

    // Change file specified in `serverMiddleware` (nuxt.config.js)
    const serverMiddlewarePath = join(rootDir, 'middleware.js')
    writeFileSync(serverMiddlewarePath, '// This file is used to test custom chokidar watchers.\n')

    // Wait 2s for picking up changes
    await Utils.waitFor(2000)

    // [Add actual test for changes here]

    await close(nuxtDev)
  })

  test('nuxt start', async () => {
    let stdout = ''
    let error

    const env = process.env
    env.PORT = port = await getPort()

    await new Promise((resolve) => {
      const nuxtBuild = spawnNuxt('build', { env })
      nuxtBuild.on('close', () => { resolve() })
    })

    const nuxtStart = spawnNuxt('start', { env })

    nuxtStart.stdout.on('data', (data) => { stdout += data })
    nuxtStart.on('error', (err) => { error = err })

    // Wait max 40s for the starting
    if (await waitUntil(() => stdout.includes(`${port}`), 40)) {
      error = 'server failed to start successfully in 40 seconds'
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('Listening on')).toBe(true)

    const html = await rp(url('/'))
    expect(html).toMatch(('<div>CLI Test</div>'))

    await close(nuxtStart)
  })
})
