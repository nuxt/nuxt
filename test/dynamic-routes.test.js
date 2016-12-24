import test from 'ava'
import { resolve } from 'path'
import fs from 'fs'
import pify from 'pify'
const readFile = pify(fs.readFile)

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const Nuxt = require('../')
  const nuxt = new Nuxt({
    rootDir: resolve(__dirname, 'fixtures/dynamic-routes'),
    dev: false
  })
  await nuxt.build()
})

test('Check .nuxt/router.js', t => {
  return readFile(resolve(__dirname, './fixtures/dynamic-routes/.nuxt/router.js'), 'utf-8')
  .then((routerFile) => {
    routerFile = routerFile.slice(
      routerFile.indexOf('routes: ['),
      -3
    )
    .replace('routes: [', '[')
    .replace(/ _[0-9A-z]+,/g, ' "",')
    let routes = eval('( ' + routerFile + ')') // eslint-disable-line no-eval
    // pages/test/index.vue
    t.is(routes[0].path, '/test')
    t.is(routes[0].name, 'test')
    // pages/parent.vue
    t.is(routes[1].path, '/parent')
    t.falsy(routes[1].name) // parent route has no name
    // pages/parent/*.vue
    t.is(routes[1].children.length, 3) // parent has 3 children
    t.deepEqual(routes[1].children.map((r) => r.path), ['', 'teub', 'child'])
    t.deepEqual(routes[1].children.map((r) => r.name), ['parent', 'parent-teub', 'parent-child'])
    // pages/test/users.vue
    t.is(routes[2].path, '/test/users')
    t.falsy(routes[2].name) // parent route has no name
    // pages/test/users/*.vue
    t.is(routes[2].children.length, 3) // parent has 3 children
    t.deepEqual(routes[2].children.map((r) => r.path), ['', ':id', ':index/teub'])
    t.deepEqual(routes[2].children.map((r) => r.name), ['test-users', 'test-users-id', 'test-users-index-teub'])
    // pages/_slug.vue
    t.is(routes[3].path, '/:slug?')
    t.is(routes[3].name, 'slug')
    // pages/_key/_id.vue
    t.is(routes[4].path, '/:key?/:id?')
    t.is(routes[4].name, 'key-id')
  })
})
