import { promisify } from 'util'
import test from 'ava'
import { resolve } from 'path'
import fs from 'fs'
import { Nuxt, Builder } from '..'
import { interceptLog, release } from './helpers/console'

const readFile = promisify(fs.readFile)
const rootDir = resolve(__dirname, 'fixtures/dll')
const dllDir = resolve(rootDir, '.cache/client-dll')

const checkCache = (lib) => {
  return async (t) => {
    const manifest = await readFile(resolve(dllDir, `./${lib}-manifest.json`), 'utf-8')
    t.truthy(JSON.parse(manifest).name)
    t.true(fs.existsSync(resolve(dllDir, `./${JSON.parse(manifest).name}.js`)))
  }
}

let nuxt

test.serial('Init Nuxt.js', async t => {
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = true

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
  })
  t.true(logSpy.calledWithMatch('DONE'))
})

test('Check vue cache', checkCache('vue'))

test('Check vue-meta cache', checkCache('vue-meta'))

test('Check vue-router cache', checkCache('vue-router'))

test('Build with DllReferencePlugin', async t => {
  const logSpy = await interceptLog()
  await new Builder(nuxt).build()
  release()
  t.true(logSpy.withArgs('Using dll for 3 libs').calledOnce)
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing nuxt.js', t => {
  nuxt.close()
})
