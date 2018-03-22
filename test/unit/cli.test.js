import { exec, spawn } from 'child_process'
import { resolve } from 'path'
import { promisify } from 'util'
import rp from 'request-promise-native'
import { Utils } from '../../'

const execify = promisify(exec)
const rootDir = resolve(__dirname, '..', 'fixtures/basic')

let port
const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '..', '..', 'bin', 'nuxt')

describe.skip('cli', () => {
  test('nuxt build', async () => {
    const { stdout } = await execify(`node ${nuxtBin} build ${rootDir}`)

    expect(stdout.includes('Compiled successfully')).toBe(true)
  })

  test('nuxt build -> error config', async () => {
    await expect(execify(`node ${nuxtBin} build ${rootDir} -c config.js`)).rejects.toMatchObject({
      stderr: expect.stringContaining('Could not load config file')
    })
  })

  test('nuxt start', async () => {
    let stdout = ''
    // let stderr = ''
    let error
    let exitCode

    const env = process.env
    env.PORT = port

    const nuxtStart = spawn('node', [nuxtBin, 'start', rootDir], { env: env })

    nuxtStart.stdout.on('data', data => {
      stdout += data
    })

    nuxtStart.stderr.on('data', data => {
      // stderr += data
    })

    nuxtStart.on('error', err => {
      error = err
    })

    nuxtStart.on('close', code => {
      exitCode = code
    })

    // Give the process max 20s to start
    let iterator = 0
    while (!stdout.includes('OPEN') && iterator < 80) {
      await Utils.waitFor(250)
      iterator++
    }

    if (iterator === 80) {
      test.log('WARN: server failed to start successfully in 20 seconds')
    }

    expect(error).toBe(undefined)
    expect(stdout.includes('OPEN')).toBe(true)

    const html = await rp(url('/users/1'))
    expect(html.includes('<h1>User: 1</h1>')).toBe(true)

    nuxtStart.kill()

    // Wait max 10s for the process to be killed
    iterator = 0
    // eslint-disable-next-line  no-unmodified-loop-condition
    while (exitCode === undefined && iterator < 40) {
      await Utils.waitFor(250)
      iterator++
    }

    if (iterator >= 40) {
      // eslint-disable-line no-console
      test.log(
        `WARN: we were unable to automatically kill the child process with pid: ${
          nuxtStart.pid
        }`
      )
    }

    expect(exitCode).toBe(null)
  })

  test('nuxt generate', async () => {
    const { stdout } = await execify(`node ${nuxtBin} generate ${rootDir}`)

    expect(stdout.includes('vue-ssr-client-manifest.json')).toBe(true)
  })
})
