import { promisify } from 'util'
import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { exec, spawn } from 'child_process'
import { Utils } from '..'

const execify = promisify(exec)
const rootDir = resolve(__dirname, 'fixtures/basic')

const port = 4011
const url = route => 'http://localhost:' + port + route

const nuxtBin = resolve(__dirname, '..', 'bin', 'nuxt')

test.serial('nuxt build', async t => {
  const { stdout, stderr } = await execify(`node ${nuxtBin} build ${rootDir}`)

  t.true(stdout.includes('server-bundle.json'))
  t.true(stderr.includes('Building done'))
})

test.serial('nuxt build -> error config', async t => {
  const { stderr } = await t.throws(execify(`node ${nuxtBin} build ${rootDir} -c config.js`))
  t.true(stderr.includes('Could not load config file'))
})

test.serial('nuxt start', async t => {
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
    t.log('WARN: server failed to start successfully in 20 seconds')
  }

  t.is(error, undefined)
  t.true(stdout.includes('OPEN'))

  const html = await rp(url('/users/1'))
  t.true(html.includes('<h1>User: 1</h1>'))

  nuxtStart.kill()

  // Wait max 10s for the process to be killed
  iterator = 0
  // eslint-disable-next-line  no-unmodified-loop-condition
  while (exitCode === undefined && iterator < 40) {
    await Utils.waitFor(250)
    iterator++
  }

  if (iterator >= 40) {
    t.log(
      `WARN: we were unable to automatically kill the child process with pid: ${
        nuxtStart.pid
      }`
    )
  }

  t.is(exitCode, null)
})

test.serial('nuxt generate', async t => {
  const { stdout } = await execify(`node ${nuxtBin} generate ${rootDir}`)

  t.true(stdout.includes('server-bundle.json'))
})
