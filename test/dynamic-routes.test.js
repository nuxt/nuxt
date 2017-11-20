import test from 'ava'
import { resolve } from 'path'
import fs from 'fs'
import pify from 'pify'
import { Nuxt, Builder } from '../index.js'

const readFile = pify(fs.readFile)

test.before('Init Nuxt.js', async t => {
  const nuxt = new Nuxt({
    rootDir: resolve(__dirname, 'fixtures/dynamic-routes'),
    dev: false
  })
  await new Builder(nuxt).build()
})

test('Check .nuxt/router.js', t => {
  return readFile(resolve(__dirname, './fixtures/dynamic-routes/.nuxt/router.js'), 'utf-8')
    .then((routerFile) => {
      routerFile = routerFile
        .slice(routerFile.indexOf('routes: ['))
        .replace('routes: [', '[')
        .replace(/ _[0-9A-z]+,/g, ' "",')
      routerFile = routerFile.substr(routerFile.indexOf('['), routerFile.lastIndexOf(']') + 1)
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
      // pages/test/projects/index.vue
      t.is(routes[4].path, '/test/projects')
      t.is(routes[4].name, 'test-projects')
      // pages/test/users.vue
      t.is(routes[5].path, '/test/users')
      t.falsy(routes[5].name) // parent route has no name
      // pages/test/users/*.vue
      t.is(routes[5].children.length, 5) // parent has 5 children
      t.deepEqual(routes[5].children.map((r) => r.path), ['', 'projects', 'projects/:category', ':id', ':index/teub'])
      t.deepEqual(routes[5].children.map((r) => r.name), ['test-users', 'test-users-projects', 'test-users-projects-category', 'test-users-id', 'test-users-index-teub'])
      // pages/test/songs/toto.vue
      t.is(routes[6].path, '/test/songs/toto')
      t.is(routes[6].name, 'test-songs-toto')
      // pages/test/songs/_id.vue
      t.is(routes[7].path, '/test/songs/:id?')
      t.is(routes[7].name, 'test-songs-id')
      // pages/test/projects/_category.vue
      t.is(routes[8].path, '/test/projects/:category')
      t.is(routes[8].name, 'test-projects-category')
      // pages/users/_id.vue
      t.is(routes[9].path, '/users/:id?')
      t.is(routes[9].name, 'users-id')
      // pages/test/_.vue
      t.is(routes[10].path, '/test/*')
      t.is(routes[10].name, 'test-all')
      // pages/_slug.vue
      t.is(routes[11].path, '/:slug')
      t.is(routes[11].name, 'slug')
      // pages/_key/_id.vue
      t.is(routes[12].path, '/:key/:id?')
      t.is(routes[12].name, 'key-id')
      // pages/_.vue
      t.is(routes[13].path, '/*/p/*')
      t.is(routes[13].name, 'all-p-all')
      // pages/_/_.vue
      t.is(routes[14].path, '/*/*')
      t.is(routes[14].name, 'all-all')
      // pages/_.vue
      t.is(routes[15].path, '/*')
      t.is(routes[15].name, 'all')
    })
})
