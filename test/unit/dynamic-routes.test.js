import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('dynamic routes', () => {
  test('Check .nuxt/router.js', () => {
    return readFile(
      resolve(__dirname, '..', 'fixtures/dynamic-routes/.nuxt/router.js'),
      'utf-8'
    ).then((routerFile) => {
      routerFile = routerFile
        .slice(routerFile.indexOf('routes: ['))
        .replace('routes: [', '[')
        .replace(/ _[0-9A-Za-z]+,/g, ' "",')
      routerFile = routerFile.substr(
        routerFile.indexOf('['),
        routerFile.lastIndexOf(']') + 1
      )
      const routes = eval('( ' + routerFile + ')') // eslint-disable-line no-eval
      // pages/test/index.vue
      expect(routes[0].path).toBe('/parent')
      expect(routes[0].name).toBeFalsy() // parent route has no name
      // pages/parent/*.vue
      expect(routes[0].children.length).toBe(3) // parent has 3 children
      expect(routes[0].children.map(r => r.path)).toEqual(['', 'child', 'teub'])
      expect(routes[0].children.map(r => r.name)).toEqual([
        'parent',
        'parent-child',
        'parent-teub'
      ])
      // pages/posts.vue
      expect(routes[1].path).toBe('/posts')
      expect(routes[1].name).toBe('posts')
      expect(routes[1].children.length).toBe(1)
      // pages/posts/_id.vue
      expect(routes[1].children[0].path).toBe(':id?')
      expect(routes[1].children[0].name).toBe('posts-id')
      // pages/parent.vue
      expect(routes[2].path).toBe('/test')
      expect(routes[2].name).toBe('test')
      // pages/test/projects/index.vue
      expect(routes[3].path).toBe('/test/projects')
      expect(routes[3].name).toBe('test-projects')
      // pages/test/users.vue
      expect(routes[4].path).toBe('/test/users')
      expect(routes[4].name).toBeFalsy() // parent route has no name
      // pages/test/users/*.vue
      expect(routes[4].children.length).toBe(5) // parent has 5 children
      expect(routes[4].children.map(r => r.path)).toEqual([
        '',
        'projects',
        'projects/:category',
        ':id',
        ':index/teub'
      ])
      expect(routes[4].children.map(r => r.name)).toEqual([
        'test-users',
        'test-users-projects',
        'test-users-projects-category',
        'test-users-id',
        'test-users-index-teub'
      ])
      // pages/test/songs/toto.vue
      expect(routes[5].path).toBe('/test/songs/toto')
      expect(routes[5].name).toBe('test-songs-toto')
      // pages/test/projects/_category.vue
      expect(routes[6].path).toBe('/test/projects/:category')
      expect(routes[6].name).toBe('test-projects-category')
      // pages/test/songs/_id.vue
      expect(routes[7].path).toBe('/test/songs/:id?')
      expect(routes[7].name).toBe('test-songs-id')
      // pages/users/_id.vue
      expect(routes[8].path).toBe('/users/:id?')
      expect(routes[8].name).toBe('users-id')
      // pages/test/_.vue
      expect(routes[9].path).toBe('/test/*')
      expect(routes[9].name).toBe('test-all')

      // pages/index.vue
      expect(routes[10].path).toBe('/')
      expect(routes[10].name).toBe('index')

      // pages/_slug.vue
      expect(routes[11].path).toBe('/:slug')
      expect(routes[11].name).toBe('slug')
      // pages/_key/_id.vue
      expect(routes[12].path).toBe('/:key/:id?')
      expect(routes[12].name).toBe('key-id')
      // pages/_.vue
      expect(routes[13].path).toBe('/*/p/*')
      expect(routes[13].name).toBe('all-p-all')
      // pages/_/_.vue
      expect(routes[14].path).toBe('/*/*')
      expect(routes[14].name).toBe('all-all')
      // pages/_.vue
      expect(routes[15].path).toBe('/*')
      expect(routes[15].name).toBe('all')
    })
  })
})
