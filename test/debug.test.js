import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'
import { interceptLog, interceptError, release } from './helpers/console'

const port = 4009
const url = (route) => 'http://localhost:' + port + route

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.serial('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/debug')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  })

  t.true(logSpy.calledWithMatch('DONE'))
  t.true(logSpy.calledWithMatch('OPEN'))
})

test.serial('/test/__open-in-editor (open-in-editor)', async t => {
  const logSpy = await interceptLog()
  const { body } = await rp(url('/test/__open-in-editor?file=pages/index.vue'), { resolveWithFullResponse: true })
  t.is(body, 'opened in editor!')
  release()
  t.is(logSpy.getCall(0).args[0], '[open in editor]')
  t.true(logSpy.calledOnce)
})

test.serial('/test/__open-in-editor should return error (open-in-editor)', async t => {
  const logSpy = await interceptLog()
  const { body } = await rp(url('/test/__open-in-editor?file='), { resolveWithFullResponse: true })
  t.is(body, 'File is not specified')
  release()
  t.is(logSpy.getCall(0).args[0], '[open in editor]')
  t.true(logSpy.calledOnce)
})

test.serial('/test/error should return error stack trace (Youch)', async t => {
  const errorSpy = await interceptError()
  const { response, error } = await t.throws(nuxt.renderAndGetWindow(url('/test/error')))
  t.is(response.statusCode, 500)
  t.is(response.statusMessage, 'NuxtServerError')
  t.true(error.includes('test youch !'))
  t.true(error.includes('<div class="error-frames">'))
  release()
  t.true(errorSpy.calledTwice)
  t.true(errorSpy.getCall(0).args[0].includes('test youch !'))
  t.true(errorSpy.getCall(1).args[0].message.includes('test youch !'))
})

test.serial('/test/error no source-map (Youch)', async t => {
  const sourceMaps = nuxt.renderer.resources.serverBundle.maps
  nuxt.renderer.resources.serverBundle.maps = {}

  const errorSpy = await interceptError()
  const { response, error } = await t.throws(nuxt.renderAndGetWindow(url('/test/error')))
  t.is(response.statusCode, 500)
  t.is(response.statusMessage, 'NuxtServerError')
  t.true(error.includes('test youch !'))
  t.true(error.includes('<div class="error-frames">'))
  release()
  t.true(errorSpy.calledTwice)
  t.true(errorSpy.getCall(0).args[0].includes('test youch !'))
  t.true(errorSpy.getCall(1).args[0].message.includes('test youch !'))

  nuxt.renderer.resources.serverBundle.maps = sourceMaps
})

test.serial('/test/error should return json format error (Youch)', async t => {
  const opts = {
    headers: {
      'accept': 'application/json'
    },
    resolveWithFullResponse: true
  }
  const errorSpy = await interceptError()
  const { response: { headers } } = await t.throws(rp(url('/test/error'), opts))
  t.is(headers['content-type'], 'text/json; charset=utf-8')
  release()
  t.true(errorSpy.calledTwice)
  t.true(errorSpy.getCall(0).args[0].includes('test youch !'))
  t.true(errorSpy.getCall(1).args[0].message.includes('test youch !'))
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
