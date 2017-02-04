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
    // pages/index.vue
    t.is(routes[0].path, '/')
    t.is(routes[0].name, 'index')
    // pages/test/index.vue
    t.is(routes[1].path, '/test')
    t.is(routes[1].name, 'test')
    // pages/posts.vue
    t.is(routes[2].path, '/posts')
    t.is(routes[2].name, 'posts')
    t.is(routes[2].children.length, 1)
    // pages/posts/_id.vue
    t.is(routes[2].children[0].path, ':id?')
    t.is(routes[2].children[0].name, 'posts-id')
    // pages/parent.vue
    t.is(routes[3].path, '/parent')
    t.falsy(routes[3].name) // parent route has no name
    // pages/parent/*.vue
    t.is(routes[3].children.length, 3) // parent has 3 children
    t.deepEqual(routes[3].children.map((r) => r.path), ['', 'teub', 'child'])
    t.deepEqual(routes[3].children.map((r) => r.name), ['parent', 'parent-teub', 'parent-child'])
    // pages/test/users.vue
    t.is(routes[4].path, '/test/users')
    t.falsy(routes[4].name) // parent route has no name
    // pages/test/users/*.vue
    t.is(routes[4].children.length, 3) // parent has 3 children
    t.deepEqual(routes[4].children.map((r) => r.path), ['', ':id', ':index/teub'])
    t.deepEqual(routes[4].children.map((r) => r.name), ['test-users', 'test-users-id', 'test-users-index-teub'])
    // pages/test/songs/toto.vue
    t.is(routes[5].path, '/test/songs/toto')
    t.is(routes[5].name, 'test-songs-toto')
    // pages/test/songs/_id.vue
    t.is(routes[6].path, '/test/songs/:id?')
    t.is(routes[6].name, 'test-songs-id')
    // pages/users/_id.vue
    t.is(routes[7].path, '/users/:id?')
    t.is(routes[7].name, 'users-id')
    // pages/test/_.vue
    t.is(routes[8].path, '/test/*')
    t.is(routes[8].name, 'test-all')
    // pages/_slug.vue
    t.is(routes[9].path, '/:slug')
    t.is(routes[9].name, 'slug')
    // pages/_key/_id.vue
    t.is(routes[10].path, '/:key/:id?')
    t.is(routes[10].name, 'key-id')
    // pages/_.vue
    t.is(routes[11].path, '/*')
    t.is(routes[11].name, 'all')
  })
})
