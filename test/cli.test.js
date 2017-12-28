import { promisify } from 'util'
import test from 'ava'
import { resolve, sep } from 'path'
import rp from 'request-promise-native'
import { exec, spawn } from 'child_process'
import { Utils } from '..'

const execify = promisify(exec)
const rootDir = resolve(__dirname, 'fixtures/basic')

const port = 4011
const url = (route) => 'http://localhost:' + port + route

test.serial('bin/nuxt-build', async t => {
  const binBuild = resolve(__dirname, '..', 'bin', 'nuxt-build')

  const { stdout, stderr } = await execify(`node ${binBuild} ${rootDir}`)

  t.true(stdout.includes('server-bundle.json'))
  t.true(stderr.includes('Building done'))
})

test.serial('bin/nuxt-start', async t => {
  const binStart = resolve(__dirname, '..', 'bin', 'nuxt-start')

  let stdout = ''
  let stderr = ''
  let error
  let exitCode

  const env = process.env
  env.PORT = port

  const nuxtStart = spawn('node', [binStart, rootDir], { env: env })

  nuxtStart.stdout.on('data', (data) => {
    stdout += data
  })

  nuxtStart.stderr.on('data', (data) => {
    stderr += data
  })

  nuxtStart.on('error', (err) => {
    error = err
  })

  nuxtStart.on('close', (code) => {
    exitCode = code
  })

  // Give the process max 10s to start
  let iterator = 0
  while (!stdout.includes('OPEN') && iterator < 40) {
    await Utils.waitFor(250)
    iterator++
  }

  t.is(error, undefined)
  t.true(stdout.includes('OPEN'))

  const html = await rp(url('/users/1'))
  t.true(html.includes('<h1>User: 1</h1>'))

  nuxtStart.kill()

  // Wait max 10s for the process to be killed
  iterator = 0
  while (exitCode === undefined && iterator < 40) { // eslint-disable-line no-unmodified-loop-condition
    await Utils.waitFor(250)
    iterator++
  }

  if (iterator >= 40) {
    t.log(`WARN: we were unable to automatically kill the child process with pid: ${nuxtStart.pid}`)
  }

  t.is(stderr, '')
  t.is(exitCode, null)
})

test.serial('bin/nuxt-generate', async t => {
  const binGenerate = resolve(__dirname, '..', 'bin', 'nuxt-generate')

  const { stdout, stderr } = await execify(`node ${binGenerate} ${rootDir}`)

  t.true(stdout.includes('server-bundle.json'))
  t.true(stderr.includes('Destination folder cleaned'))
  t.true(stderr.includes('Static & build files copied'))
  t.true(stderr.includes(`Generate file: ${sep}users${sep}1${sep}index.html`))
  t.true(stderr.includes('Error report'))
  t.true(stderr.includes('Generate done'))
})
