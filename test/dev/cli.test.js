import { resolve, join } from 'path'
import { spawn } from 'cross-spawn'
import { writeFileSync } from 'fs-extra'
import { getPort, rp, waitFor } from '../utils'

let port
const rootDir = resolve(__dirname, '..', 'fixtures/cli')

const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '../../packages/cli/bin/nuxt-cli.js')
const spawnNuxt = (command, opts) => spawn(nuxtBin, [command, rootDir], opts)

const start = (cmd, env, cb) => {
  return new Promise((resolve) => {
    const nuxt = spawnNuxt(cmd, { env, detached: true })
    const listener = (data) => {
      if (data.includes(`${port}`)) {
        nuxt.stdout.removeListener('data', listener)
        resolve(nuxt)
      }
    }
    if (typeof cb === 'function') {
      cb(nuxt)
    }
    nuxt.stdout.on('data', listener)
  })
}

const close = (nuxt) => {
  return new Promise((resolve) => {
    nuxt.on('exit', resolve)
    process.kill(-nuxt.pid)
  })
}

describe.posix('cli', () => {
  test.skip('nuxt dev', async () => {
    const { env } = process
    env.PORT = port = await getPort()

    const nuxtDev = await start('dev', env)

    // Change file specified in `watchers` (nuxt.config.js)
    const customFilePath = join(rootDir, 'custom.file')
    writeFileSync(customFilePath, 'This file is used to test custom chokidar watchers.')

    // Change file specified in `serverMiddleware` (nuxt.config.js)
    const serverMiddlewarePath = join(rootDir, 'middleware.js')
    writeFileSync(serverMiddlewarePath, '// This file is used to test custom chokidar watchers.\n')

    // Wait 2s for picking up changes
    await waitFor(2000)

    // [Add actual test for changes here]

    await close(nuxtDev)
  })

  test.skip('nuxt start', async () => {
    let error

    const { env } = process
    env.PORT = port = await getPort()

    await new Promise((resolve) => {
      const nuxtBuild = spawnNuxt('build', { env })
      nuxtBuild.on('close', resolve)
    })

    const nuxtStart = await start('start', env, (nuxtStart) => {
      nuxtStart.on('error', (err) => { error = err })
    })

    expect(error).toBe(undefined)

    const { body: html } = await rp(url('/'))
    expect(html).toMatch(('<div>CLI Test</div>'))

    await close(nuxtStart)
  })
})
