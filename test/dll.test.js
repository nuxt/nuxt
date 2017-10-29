import test from 'ava'
import { resolve } from 'path'
import fs from 'fs'
import pify from 'pify'
import { Nuxt, Builder } from '../index.js'

const readFile = pify(fs.readFile)
const rootDir = resolve(__dirname, './fixtures/dll')
const dllDir = resolve(rootDir, '.cache/client-dll')

const checkCache = (lib) => {
  return async (t) => {
    const manifest = await readFile(resolve(dllDir, `./${lib}-manifest.json`), 'utf-8')
    t.truthy(JSON.parse(manifest).name)
    t.true(fs.existsSync(resolve(dllDir, `./${JSON.parse(manifest).name}.js`)))
  }
}

test.before('Init Nuxt.js', async t => {
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = true
  const nuxt = new Nuxt(config)
  await new Builder(nuxt).build()
})

test('Check vue cache', checkCache('vue'))

test('Check vue-meta cache', checkCache('vue-meta'))

test('Check vue-router cache', checkCache('vue-router'))
