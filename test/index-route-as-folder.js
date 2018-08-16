import test from 'ava'
import { resolve } from 'path'
import fs from 'fs'
import { Nuxt, Builder } from '..'
import { promisify } from 'util'
import { interceptLog } from './helpers/console'

const readFile = promisify(fs.readFile)

test.serial('Init Nuxt.js', async t => {
  const config = {
    rootDir: resolve(__dirname, 'fixtures/index-route-as-folder'),
    dev: false,
    build: {
      stats: false
    }
  }

  const logSpy = await interceptLog(async () => {
    const nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
  })
  t.true(logSpy.calledWithMatch('DONE'))
})

test('Check .nuxt/router.js', t => {
  return readFile(
    resolve(__dirname, './fixtures/index-route-as-folder/.nuxt/router.js'),
    'utf-8'
  ).then(routerFile => {
    routerFile = routerFile
      .slice(routerFile.indexOf('routes: ['))
      .replace('routes: [', '[')
      .replace(/ _[0-9A-z]+,/g, ' "",')
    routerFile = routerFile.substr(
      routerFile.indexOf('['),
      routerFile.lastIndexOf(']') + 1
    )
    let routes = eval('( ' + routerFile + ')') // eslint-disable-line no-eval

    // pages/index.vue
    t.is(routes[0].path, '')
    t.is(routes[0].name, 'index')
  })
})
